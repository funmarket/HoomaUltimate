import { useEffect, useState } from "react";
import { useHoomaFrontend } from "../context";
import { HoomaApiError } from "../http";
import type { EventRsvpState, PublicEvent } from "./api";
import { useEventApi } from "./useEventApi";

type ActiveRsvpState = "CONFIRMED" | "WAITLISTED" | "ATTENDED" | null;

function activeRsvp(status: EventRsvpState | undefined): ActiveRsvpState {
  return status === "CONFIRMED" || status === "WAITLISTED" || status === "ATTENDED" ? status : null;
}

export function EventDetailPage({ eventId }: { readonly eventId: string }) {
  const eventApi = useEventApi();
  const { protectedError } = useHoomaFrontend();
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [rsvp, setRsvp] = useState<ActiveRsvpState>(null);
  const [participationLoading, setParticipationLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void reloadEvent();
    void reloadParticipation();
  }, [eventApi, eventId]);

  async function reloadEvent() {
    try {
      setEvent(await eventApi.publicDetail(eventId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load event");
    }
  }

  async function reloadParticipation() {
    setParticipationLoading(true);
    try {
      const result = await eventApi.myRsvp(eventId);
      setRsvp(activeRsvp(result.rsvp?.status));
    } catch (reason) {
      if (reason instanceof HoomaApiError && reason.status === 401) {
        setRsvp(null);
      } else {
        setError(reason instanceof Error ? reason.message : "Unable to load RSVP state");
      }
    } finally {
      setParticipationLoading(false);
    }
  }

  async function join() {
    setActionPending(true);
    setError("");
    setStatus("");
    try {
      const result = await eventApi.join(eventId);
      setRsvp(result.status);
      setStatus(result.status === "WAITLISTED" ? "Added to the waitlist." : "You are going.");
      await reloadEvent();
    } catch (reason) {
      setError(protectedError(reason, "Unable to join game"));
    } finally {
      setActionPending(false);
    }
  }

  async function leave() {
    setActionPending(true);
    setError("");
    setStatus("");
    try {
      await eventApi.cancelRsvp(eventId);
      setRsvp(null);
      setStatus("RSVP cancelled.");
      await reloadEvent();
    } catch (reason) {
      setError(protectedError(reason, "Unable to leave game"));
    } finally {
      setActionPending(false);
    }
  }

  if (!event) return error ? <p className="error">{error}</p> : <p className="status">Loading event…</p>;

  const eventOpen = event.status !== "COMPLETED";
  let participationAction = null;
  if (rsvp === "ATTENDED") {
    participationAction = <span className="status">Checked in</span>;
  } else if (rsvp === "WAITLISTED") {
    participationAction = <button type="button" disabled={actionPending} onClick={() => void leave()}>{actionPending ? "Updating…" : "Leave waitlist"}</button>;
  } else if (rsvp === "CONFIRMED") {
    participationAction = <button type="button" disabled={actionPending} onClick={() => void leave()}>{actionPending ? "Updating…" : "Leave game"}</button>;
  } else if (eventOpen) {
    participationAction = <button type="button" disabled={actionPending || participationLoading} onClick={() => void join()}>{actionPending ? "Joining…" : "Join game"}</button>;
  }

  return <section className="event-detail"><p className="eyebrow">{event.type}</p><h2>{event.title}</h2><p>{event.description}</p><div className="panel event-meta"><div><span>When</span><strong>{new Date(event.startsAt).toLocaleString()}</strong></div><div><span>Where</span><strong>{event.venueName || event.address || "To be confirmed"}</strong></div><div><span>Players</span><strong>{event._count.rsvps}{event.capacity ? ` / ${event.capacity}` : ""}</strong></div><div><span>Format</span><strong>{event.playDetails?.format?.replaceAll("_", " ") || "—"}</strong></div></div><div className="event-actions">{participationAction}<a href={`/events/${eventId}/formation`}>Formation</a><a href={`/events/${eventId}/chat`}>Event chat</a><a href={`/events/${eventId}/check-in`}>Check in</a></div>{status ? <p className="success">{status}</p> : null}{error ? <p className="error">{error}</p> : null}</section>;
}
