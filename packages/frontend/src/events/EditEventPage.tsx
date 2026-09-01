import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PlayEventVisibility } from "@hooma/contracts";
import { useHoomaFrontend } from "../context";
import { createEventApi, type PublicEvent } from "./api";
import { WatchEventForm, type WatchEventFormValue } from "./WatchEventForm";

export function EditEventPage({ eventId }: { readonly eventId: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createEventApi(transport), [transport]);
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .manage(eventId)
      .then(setEvent)
      .catch((reason) => setError(protectedError(reason, "Unable to open Event settings")));
  }, [api, eventId, protectedError]);

  async function saveWatch(value: WatchEventFormValue) {
    if (!event || event.type !== "WATCH") return;
    setPending(true);
    setNotice("");
    setError("");
    try {
      const updated = await api.update(event.id, {
        title: value.title,
        description: value.description,
        startsAt: value.startsAt,
        endsAt: value.endsAt,
        capacity: value.capacity,
        watch: value.watch,
      });
      setEvent(updated);
      setNotice("Watch event saved.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to save Watch event"));
    } finally {
      setPending(false);
    }
  }

  async function savePlay(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event || event.type !== "PLAY") return;
    const data = new FormData(eventForm.currentTarget);
    const visibility = String(data.get("visibility")) as PlayEventVisibility;
    setPending(true);
    setNotice("");
    setError("");
    try {
      const updated = await api.update(event.id, { play: { visibility } });
      setEvent(updated);
      setNotice("Match visibility saved.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to save match visibility"));
    } finally {
      setPending(false);
    }
  }

  async function deleteEvent() {
    if (!event || deleting) return;
    const surface = event.type === "WATCH" ? "Watch" : "Play";
    if (
      !window.confirm(
        `Delete ${event.title}? It will leave active ${surface} surfaces while participation history is preserved.`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      await api.cancel(event.id);
      window.location.href = event.type === "WATCH" ? "/watch" : "/play";
    } catch (reason) {
      setError(protectedError(reason, `Unable to delete ${surface} event`));
      setDeleting(false);
    }
  }

  if (!event)
    return error ? (
      <p className="error">{error}</p>
    ) : (
      <p className="status">Loading Event settings…</p>
    );

  if (event.type === "PLAY") {
    return (
      <section className="watch-event-form-page">
        <a className="place-back-link" href={`/events/${event.id}`}>
          ← Match
        </a>
        <header className="watch-event-form-page__header">
          <p className="eyebrow">PLAY MATCH SETTINGS</p>
          <h1>Edit Match</h1>
          <p>Control who can discover this match without changing community privacy.</p>
        </header>
        <form className="event-form panel" onSubmit={savePlay}>
          <label>
            Match visibility
            <select name="visibility" defaultValue={event.playDetails?.visibility ?? "OPEN"}>
              <option value="OPEN">Open match</option>
              <option value="PRIVATE">Private match</option>
            </select>
            <span className="muted">
              Open matches are visible to every signed-in HOOMA account. Private matches are limited
              to managers, participants, and invited players.
            </span>
          </label>
          <button type="submit" disabled={pending || deleting}>
            {pending ? "Saving…" : "Save Match"}
          </button>
        </form>
        {notice ? <p className="success">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
        <section className="entity-danger-zone event-danger-zone">
          <p className="eyebrow">EVENT MANAGEMENT</p>
          <h3>Delete Match</h3>
          <p>Remove this match from active Play surfaces while keeping its historical records.</p>
          <button type="button" disabled={deleting || pending} onClick={() => void deleteEvent()}>
            {deleting ? "Deleting…" : "Delete Match"}
          </button>
        </section>
      </section>
    );
  }

  return (
    <section className="watch-event-form-page">
      <a className="place-back-link" href={`/events/${event.id}`}>
        ← Event
      </a>
      <header className="watch-event-form-page__header">
        <p className="eyebrow">WATCH EVENT SETTINGS</p>
        <h1>Edit Event</h1>
        <p>Update this Watch event without changing its published event type.</p>
      </header>
      <WatchEventForm
        places={[]}
        initialEvent={event}
        lockPlace
        submitLabel="Save Event"
        pending={pending}
        onSubmit={saveWatch}
      />
      {notice ? <p className="success">{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}
      <section className="entity-danger-zone event-danger-zone">
        <p className="eyebrow">EVENT MANAGEMENT</p>
        <h3>Delete Event</h3>
        <p>Remove this event from active Watch feeds while keeping its historical records.</p>
        <button type="button" disabled={deleting || pending} onClick={() => void deleteEvent()}>
          {deleting ? "Deleting…" : "Delete Event"}
        </button>
      </section>
    </section>
  );
}
