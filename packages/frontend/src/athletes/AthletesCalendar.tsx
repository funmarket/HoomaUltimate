import type {
  AthletesCalendarCreateInput,
  AthletesCalendarEntry,
  AthletesCalendarEntryView,
  AthletesCalendarRsvpStatus,
  AthletesCalendarUpdateInput,
} from "@hooma/contracts/athletes";
import { useMemo, useState, type FormEvent } from "react";
import { useHoomaFrontend } from "../context";
import {
  calendarMonthCells,
  dateKeyForInstant,
  deviceTimezone,
  formatCalendarTime,
  isoToLocalInput,
  localInputToIso,
  monthKeyForDateKey,
  monthLabel,
  shiftMonth,
  todayKey,
} from "./athletes-calendar-time";
import { useAthletesCalendar } from "./useAthletesCalendar";

type Props = {
  readonly athletesCommunityId: string;
  readonly founder: boolean;
};

type EntryForm = {
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
};

const RSVP_OPTIONS: ReadonlyArray<{
  readonly status: AthletesCalendarRsvpStatus;
  readonly label: string;
}> = [
  { status: "GOING", label: "Going" },
  { status: "MAYBE", label: "Maybe" },
  { status: "NOT_GOING", label: "Not going" },
];

function defaultForm(selectedKey: string): EntryForm {
  return {
    title: "",
    description: "",
    location: "",
    startsAt: `${selectedKey}T18:00`,
    endsAt: `${selectedKey}T19:00`,
  };
}

function formForEntry(entry: AthletesCalendarEntry): EntryForm {
  return {
    title: entry.title,
    description: entry.description ?? "",
    location: entry.location ?? "",
    startsAt: isoToLocalInput(entry.startsAt),
    endsAt: isoToLocalInput(entry.endsAt),
  };
}

function rsvpCount(entry: AthletesCalendarEntryView, status: AthletesCalendarRsvpStatus): number {
  if (status === "GOING") return entry.rsvp.counts.going;
  if (status === "MAYBE") return entry.rsvp.counts.maybe;
  return entry.rsvp.counts.notGoing;
}

export function AthletesCalendar({ athletesCommunityId, founder }: Props) {
  const { api, protectedError } = useHoomaFrontend();
  const timezone = useMemo(deviceTimezone, []);
  const today = todayKey(timezone);
  const [monthKey, setMonthKey] = useState(() => monthKeyForDateKey(today));
  const [selectedKey, setSelectedKey] = useState(today);
  const [mode, setMode] = useState<"idle" | "create" | "edit">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EntryForm>(() => defaultForm(today));
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [rsvpBusyId, setRsvpBusyId] = useState<string | null>(null);
  const [rsvpError, setRsvpError] = useState("");
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const { entries, loading, loadingMore, error, hasMore, reload, loadMore } = useAthletesCalendar(
    athletesCommunityId,
    monthKey,
  );

  const cells = useMemo(() => calendarMonthCells(monthKey), [monthKey]);
  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const key = dateKeyForInstant(entry.startsAt, timezone);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [entries, timezone]);
  const selectedEntries = useMemo(
    () => entries.filter((entry) => dateKeyForInstant(entry.startsAt, timezone) === selectedKey),
    [entries, selectedKey, timezone],
  );

  function chooseDate(key: string) {
    setSelectedKey(key);
    setMode("idle");
    setEditingId(null);
    setConfirmCancelId(null);
    setActionError("");
    setRsvpError("");
  }

  function showToday() {
    const key = todayKey(timezone);
    setMonthKey(monthKeyForDateKey(key));
    chooseDate(key);
  }

  function startCreate() {
    setMode("create");
    setEditingId(null);
    setDraft(defaultForm(selectedKey));
    setActionError("");
  }

  function startEdit(entry: AthletesCalendarEntry) {
    setMode("edit");
    setEditingId(entry.id);
    setDraft(formForEntry(entry));
    setActionError("");
    setConfirmCancelId(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!founder || busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setActionError("");
    try {
      const input: AthletesCalendarCreateInput = {
        title: String(data.get("title") ?? "").trim(),
        description: String(data.get("description") ?? "").trim() || null,
        location: String(data.get("location") ?? "").trim() || null,
        startsAt: localInputToIso(String(data.get("startsAt") ?? "")),
        endsAt: localInputToIso(String(data.get("endsAt") ?? "")),
        timezone,
      };
      if (mode === "edit" && editingId) {
        const update: AthletesCalendarUpdateInput = input;
        await api.athletes.updateCalendarEntry(athletesCommunityId, editingId, update);
      } else {
        await api.athletes.createCalendarEntry(athletesCommunityId, input);
      }
      setMode("idle");
      setEditingId(null);
      await reload();
    } catch (reason) {
      setActionError(protectedError(reason, "Unable to save Calendar entry"));
    } finally {
      setBusy(false);
    }
  }

  async function cancelEntry(entryId: string) {
    if (!founder || busy) return;
    setBusy(true);
    setActionError("");
    try {
      await api.athletes.cancelCalendarEntry(athletesCommunityId, entryId);
      setConfirmCancelId(null);
      setMode("idle");
      setEditingId(null);
      await reload();
    } catch (reason) {
      setActionError(protectedError(reason, "Unable to cancel Calendar entry"));
    } finally {
      setBusy(false);
    }
  }

  async function setRsvp(entryId: string, status: AthletesCalendarRsvpStatus) {
    if (rsvpBusyId) return;
    setRsvpBusyId(entryId);
    setRsvpError("");
    try {
      await api.athletes.setCalendarRsvp(athletesCommunityId, entryId, { status });
      await reload();
    } catch (reason) {
      setRsvpError(protectedError(reason, "Unable to update your RSVP"));
    } finally {
      setRsvpBusyId(null);
    }
  }

  return (
    <section
      className="athletes-surface athletes-section athletes-calendar"
      aria-labelledby="athletes-calendar-heading"
    >
      <div className="athletes-section-heading athletes-calendar__heading">
        <div>
          <span className="eyebrow">ATHLETES · MEMBERS ONLY</span>
          <h2 id="athletes-calendar-heading">Calendar</h2>
          <p>Training, meetups and community plans in your phone timezone.</p>
        </div>
        <button type="button" className="athletes-mini-action" onClick={showToday}>
          Today
        </button>
      </div>

      <div className="athletes-calendar__month-nav">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setMonthKey(shiftMonth(monthKey, -1))}
        >
          ←
        </button>
        <strong>{monthLabel(monthKey)}</strong>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => setMonthKey(shiftMonth(monthKey, 1))}
        >
          →
        </button>
      </div>

      <div className="athletes-calendar__weekdays" aria-hidden="true">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="athletes-calendar__grid" aria-label="Calendar month">
        {cells.map((key, index) =>
          key ? (
            <button
              type="button"
              key={key}
              className={`${key === selectedKey ? "is-selected" : ""} ${key === today ? "is-today" : ""}`.trim()}
              aria-pressed={key === selectedKey}
              onClick={() => chooseDate(key)}
            >
              <span>{Number(key.slice(-2))}</span>
              {eventCounts.get(key) ? <small>{eventCounts.get(key)}</small> : null}
            </button>
          ) : (
            <span className="athletes-calendar__empty-cell" key={`empty-${index}`} />
          ),
        )}
      </div>

      <div className="athletes-calendar__agenda">
        <div className="athletes-calendar__agenda-heading">
          <div>
            <span className="eyebrow">SELECTED DATE</span>
            <strong>{selectedKey}</strong>
          </div>
          {founder ? (
            <button
              type="button"
              className="button athletes-action athletes-action--secondary athletes-action--compact"
              onClick={startCreate}
            >
              + Add plan
            </button>
          ) : null}
        </div>

        {loading ? (
          <div role="status" className="athletes-calendar__state">
            Loading Calendar…
          </div>
        ) : null}
        {error ? (
          <div className="error-box" role="alert">
            {error} <button onClick={() => void reload()}>Retry Calendar</button>
          </div>
        ) : null}
        {!loading && !error && selectedEntries.length === 0 ? (
          <div className="athletes-calendar__state">No plans for this date.</div>
        ) : null}

        {selectedEntries.map((entry) => (
          <article
            key={entry.id}
            className={`athletes-calendar__entry ${entry.cancelledAt ? "is-cancelled" : ""}`}
          >
            <div>
              <strong>{entry.title}</strong>
              <span>
                {formatCalendarTime(entry.startsAt, timezone)} –{" "}
                {formatCalendarTime(entry.endsAt, timezone)}
              </span>
              {entry.location ? <span>{entry.location}</span> : null}
              {entry.description ? <p>{entry.description}</p> : null}
              {entry.cancelledAt ? (
                <span className="athletes-calendar__cancelled">Cancelled</span>
              ) : null}
            </div>
            {entry.cancelledAt ? (
              <div className="athletes-calendar__rsvp-summary">
                Going {entry.rsvp.counts.going} · Maybe {entry.rsvp.counts.maybe} · Not going{" "}
                {entry.rsvp.counts.notGoing}
              </div>
            ) : (
              <div className="athletes-calendar__rsvp">
                <span className="eyebrow">YOUR RSVP</span>
                <div
                  className="athletes-calendar__rsvp-options"
                  role="group"
                  aria-label={`RSVP for ${entry.title}`}
                >
                  {RSVP_OPTIONS.map((option) => (
                    <button
                      key={option.status}
                      type="button"
                      className={`athletes-calendar__rsvp-button ${entry.rsvp.viewerStatus === option.status ? "is-selected" : ""}`.trim()}
                      aria-pressed={entry.rsvp.viewerStatus === option.status}
                      disabled={rsvpBusyId !== null}
                      onClick={() => void setRsvp(entry.id, option.status)}
                    >
                      <span>{option.label}</span>
                      <small>{rsvpCount(entry, option.status)}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
            {founder && !entry.cancelledAt ? (
              <div className="athletes-calendar__entry-actions">
                <button
                  type="button"
                  className="athletes-mini-action"
                  onClick={() => startEdit(entry)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="athletes-mini-action athletes-mini-action--decline"
                  onClick={() => setConfirmCancelId(entry.id)}
                >
                  Cancel plan
                </button>
              </div>
            ) : null}
            {confirmCancelId === entry.id ? (
              <div
                className="athletes-calendar__confirm"
                role="group"
                aria-label="Confirm Calendar cancellation"
              >
                <strong>Cancel this plan?</strong>
                <span>Cancellation is permanent; the entry stays visible as cancelled.</span>
                <div>
                  <button type="button" disabled={busy} onClick={() => void cancelEntry(entry.id)}>
                    Confirm cancellation
                  </button>
                  <button type="button" disabled={busy} onClick={() => setConfirmCancelId(null)}>
                    Keep plan
                  </button>
                </div>
              </div>
            ) : null}
          </article>
        ))}
        {rsvpError ? (
          <div className="error-box" role="alert">
            {rsvpError}
          </div>
        ) : null}
        {hasMore ? (
          <button
            type="button"
            className="button athletes-action athletes-action--secondary athletes-action--compact"
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading more Calendar…" : "Load more Calendar"}
          </button>
        ) : null}
      </div>

      {mode !== "idle" && founder ? (
        <form
          key={mode === "edit" ? `edit-${editingId ?? "unknown"}` : `create-${selectedKey}`}
          className="athletes-calendar__form"
          onSubmit={(event) => void submit(event)}
        >
          <h3>{mode === "edit" ? "Edit plan" : "Add plan"}</h3>
          <label>
            Title
            <input name="title" required maxLength={100} defaultValue={draft.title} />
          </label>
          <label>
            Starts
            <input name="startsAt" required type="datetime-local" defaultValue={draft.startsAt} />
          </label>
          <label>
            Ends
            <input name="endsAt" required type="datetime-local" defaultValue={draft.endsAt} />
          </label>
          <label>
            Location
            <input name="location" maxLength={200} defaultValue={draft.location} />
          </label>
          <label>
            Notes
            <textarea name="description" maxLength={600} defaultValue={draft.description} />
          </label>
          <small>Timezone: {timezone} (from this phone/device)</small>
          {actionError ? (
            <div className="error-box" role="alert">
              {actionError}
            </div>
          ) : null}
          <div className="athletes-calendar__form-actions">
            <button
              type="submit"
              className="button athletes-action athletes-action--primary"
              disabled={busy}
            >
              {busy ? "Saving…" : "Save plan"}
            </button>
            <button
              type="button"
              className="button athletes-action athletes-action--secondary"
              disabled={busy}
              onClick={() => {
                setMode("idle");
                setEditingId(null);
                setActionError("");
              }}
            >
              Close
            </button>
          </div>
        </form>
      ) : actionError ? (
        <div className="error-box" role="alert">
          {actionError}
        </div>
      ) : null}
    </section>
  );
}
