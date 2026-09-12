import type {
  AthletesCalendarEntry,
  AthletesCalendarEntryCreateInput,
} from "@hooma/contracts/athletes-calendar";
import { useMemo, useState } from "react";
import { useHoomaFrontend } from "../../context";
import { CalendarEntryForm } from "./CalendarEntryForm";
import { DayAgenda } from "./DayAgenda";
import { MonthGrid } from "./MonthGrid";
import {
  dateKeyForInstant,
  firstOfMonth,
  monthLabel,
  shiftMonth,
  todayKey,
} from "./date";
import { useAthletesCalendar } from "./useAthletesCalendar";

export function AthletesCalendar({
  athletesCommunityId,
  founder,
}: {
  readonly athletesCommunityId: string;
  readonly founder: boolean;
}) {
  const { api } = useHoomaFrontend();
  const today = todayKey();
  const [monthKey, setMonthKey] = useState(() => firstOfMonth(today));
  const [selectedKey, setSelectedKey] = useState(today);
  const [editing, setEditing] = useState<AthletesCalendarEntry | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const { entries, loading, error, reload } = useAthletesCalendar(
    athletesCommunityId,
    monthKey,
  );

  const selectedEntries = useMemo(
    () =>
      entries.filter(
        (entry) => dateKeyForInstant(entry.startsAt, entry.timezone) === selectedKey,
      ),
    [entries, selectedKey],
  );
  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      if (entry.status !== "SCHEDULED") continue;
      const key = dateKeyForInstant(entry.startsAt, entry.timezone);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [entries]);

  const selectDate = (key: string) => {
    setSelectedKey(key);
    setMonthKey(firstOfMonth(key));
    setCreating(false);
    setEditing(null);
    setActionError("");
  };

  const moveMonth = (amount: number) => {
    const nextMonth = shiftMonth(monthKey, amount);
    setMonthKey(nextMonth);
    setSelectedKey(nextMonth);
    setCreating(false);
    setEditing(null);
    setActionError("");
  };

  const save = async (input: AthletesCalendarEntryCreateInput) => {
    setBusy(true);
    setActionError("");
    try {
      const saved = editing
        ? await api.athletes.calendar.update(athletesCommunityId, editing.id, input)
        : await api.athletes.calendar.create(athletesCommunityId, input);
      const savedKey = dateKeyForInstant(saved.startsAt, saved.timezone);
      const savedMonth = firstOfMonth(savedKey);
      setSelectedKey(savedKey);
      setCreating(false);
      setEditing(null);
      if (savedMonth === monthKey) await reload();
      else setMonthKey(savedMonth);
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "Unable to save calendar event",
      );
    } finally {
      setBusy(false);
    }
  };

  const cancelEntry = async (entry: AthletesCalendarEntry) => {
    setBusy(true);
    setActionError("");
    try {
      await api.athletes.calendar.cancel(athletesCommunityId, entry.id);
      await reload();
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "Unable to cancel calendar event",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="athletes-surface athletes-section athletes-calendar">
      <div className="athletes-calendar-header">
        <div>
          <span className="eyebrow">SCHEDULE</span>
          <h2>Calendar</h2>
        </div>
        {founder ? (
          <button
            type="button"
            className="athletes-calendar-create"
            onClick={() => {
              setEditing(null);
              setCreating(true);
              setActionError("");
            }}
          >
            <span aria-hidden="true">＋</span>
            Event
          </button>
        ) : null}
      </div>

      <div className="athletes-calendar-nav">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>
          ‹
        </button>
        <button
          type="button"
          className="athletes-calendar-today"
          onClick={() => selectDate(today)}
        >
          Today
        </button>
        <strong>{monthLabel(monthKey)}</strong>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>
          ›
        </button>
      </div>

      {error ? (
        <div className="error-box" role="alert">
          {error} <button onClick={() => void reload()}>Retry</button>
        </div>
      ) : null}
      {loading ? <p className="muted athletes-calendar-loading">Loading calendar…</p> : null}

      <MonthGrid
        monthKey={monthKey}
        selectedKey={selectedKey}
        todayKey={today}
        eventCounts={eventCounts}
        onSelect={selectDate}
      />

      {creating || editing ? (
        <CalendarEntryForm
          selectedDateKey={selectedKey}
          entry={editing}
          busy={busy}
          error={actionError}
          onSubmit={(input) => void save(input)}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setActionError("");
          }}
        />
      ) : null}

      {actionError && !creating && !editing ? (
        <div className="error-box" role="alert">
          {actionError}
        </div>
      ) : null}

      <DayAgenda
        dateKey={selectedKey}
        entries={selectedEntries}
        founder={founder}
        busy={busy}
        onEdit={(entry) => {
          setCreating(false);
          setEditing(entry);
          setActionError("");
        }}
        onCancel={(entry) => void cancelEntry(entry)}
      />
    </section>
  );
}
