import { useEffect, useMemo, useState } from "react";
import { useHoomaFrontend } from "../context";
import { createEventApi, type PublicEvent } from "./api";
import { WatchEventForm } from "./WatchEventForm";

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
      .then((row) => {
        if (row.type !== "WATCH") {
          setError("This editor is for Watch events.");
          return;
        }
        setEvent(row);
      })
      .catch((reason) => setError(protectedError(reason, "Unable to open Event settings")));
  }, [api, eventId, protectedError]);

  async function save(value: Parameters<React.ComponentProps<typeof WatchEventForm>["onSubmit"]>[0]) {
    if (!event) return;
    setPending(true);
    setNotice("");
    setError("");
    try {
      const updated = await api.update(event.id, {
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

  async function deleteEvent() {
    if (!event || deleting) return;
    if (
      !window.confirm(
        `Delete ${event.title}? It will leave active Watch surfaces while participation history is preserved.`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      await api.cancel(event.id);
      window.location.href = "/watch";
    } catch (reason) {
      setError(protectedError(reason, "Unable to delete Watch event"));
      setDeleting(false);
    }
  }

  if (!event)
    return error ? <p className="error">{error}</p> : <p className="status">Loading Event settings…</p>;

  return (
    <section className="watch-event-form-page">
      <a className="place-back-link" href={`/events/${event.id}`}>
        ← Event
      </a>
      <header className="watch-event-form-page__header">
        <p className="eyebrow">WATCH EVENT SETTINGS</p>
        <h1>Edit Event</h1>
        <p>Update the same canonical Event rendered by the collector ticket.</p>
      </header>
      <WatchEventForm
        places={[]}
        initialEvent={event}
        lockPlace
        submitLabel="Save Event"
        pending={pending}
        onSubmit={save}
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
