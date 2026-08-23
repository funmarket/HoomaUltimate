import { useEffect, useState } from "react";
import { useHoomaFrontend } from "../context";
import { HoomaApiError } from "../http";
import type { EventRsvpState, PublicEvent } from "./api";
import { useEventApi } from "./useEventApi";

type ActiveRsvpState = "CONFIRMED" | "WAITLISTED" | "ATTENDED" | null;

function activeRsvp(status: EventRsvpState | undefined): ActiveRsvpState {
  return status === "CONFIRMED" || status === "WAITLISTED" || status === "ATTENDED" ? status : null;
}

function pretty(value: string | null | undefined): string {
  return value ? value.replaceAll("_", " ").toLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toUpperCase()) : "—";
}

function CalendarIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7"/><path d="M7.5 3.5v4M16.5 3.5v4M4 9h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
}
function PinIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s6.3-5.3 6.3-11A6.3 6.3 0 1 0 5.7 10C5.7 15.7 12 21 12 21Z" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6"/></svg>;
}
function UsersIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.65"/><circle cx="16.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.45"/><path d="M3.8 19c.45-4 2.2-6 5.2-6s4.75 2 5.2 6M14.1 14.2c2.65.1 4.3 1.7 4.8 4.8" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round"/></svg>;
}
function BallIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/><path d="m12 7 3 2.2-1.15 3.55h-3.7L9 9.2 12 7Zm-3 2.2-3.2.1M15 9.2l3.2.1M10.15 12.75l-2.2 3M13.85 12.75l2.2 3M7.95 15.75l.75 3.05M16.05 15.75l-.75 3.05" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round"/></svg>;
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
  const location = event.venueName || event.address || "Venue to be confirmed";
  const play = event.playDetails;
  const rsvpLabel = rsvp === "WAITLISTED" ? "WAITLISTED" : rsvp === "CONFIRMED" ? "CONFIRMED" : rsvp === "ATTENDED" ? "CHECKED IN" : null;

  return (
    <div className="play-event-page">
      <section className="play-event-card">
        <div className="play-event-card__kicker">Pickup match</div>
        <div className="play-event-card__title-row">
          <span className="play-event-card__ball"><BallIcon /></span>
          <div>
            <h1>{event.title}</h1>
            {event.description ? <p>{event.description}</p> : null}
          </div>
        </div>

        <div className="play-event-card__meta">
          <span><CalendarIcon />{new Date(event.startsAt).toLocaleString()}</span>
          <span><PinIcon />{location}</span>
          <span><UsersIcon />{event._count.rsvps}{event.capacity ? ` / ${event.capacity}` : ""} going</span>
        </div>

        <div className="play-event-card__facts">
          <div><span>Format</span><strong>{pretty(play?.format)}</strong></div>
          <div><span>Pitch</span><strong>{pretty(play?.pitchType)}</strong></div>
          <div><span>Level</span><strong>{pretty(play?.skillLevel)}</strong></div>
          <div><span>Community</span><strong>{event.community.name}</strong></div>
        </div>

        {rsvpLabel ? <div className="play-event-rsvp-state">{rsvpLabel}</div> : null}

        {rsvp === "ATTENDED" ? (
          <div className="play-event-primary-action play-event-primary-action--static">Checked in</div>
        ) : rsvp === "WAITLISTED" ? (
          <button className="play-event-primary-action" type="button" disabled={actionPending} onClick={() => void leave()}>{actionPending ? "Updating…" : "Leave waitlist"}</button>
        ) : rsvp === "CONFIRMED" ? (
          <button className="play-event-primary-action" type="button" disabled={actionPending} onClick={() => void leave()}>{actionPending ? "Updating…" : "Cancel RSVP"}</button>
        ) : eventOpen ? (
          <button className="play-event-primary-action" type="button" disabled={actionPending || participationLoading} onClick={() => void join()}>{actionPending ? "Joining…" : "Join in one tap"}</button>
        ) : null}

        {status ? <p className="success">{status}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="play-matchday-hub" aria-labelledby="play-matchday-title">
        <div>
          <p className="eyebrow">Matchday hub</p>
          <h2 id="play-matchday-title">Event actions</h2>
        </div>
        <div className="play-matchday-actions">
          <a href={`/events/${eventId}/formation`}><strong>Formation builder</strong><span>{pretty(play?.format)} · build teams and positions</span></a>
          <a href={`/events/${eventId}/chat`}><strong>Temporary event chat</strong><span>Available only to participants while the event chat window is open</span></a>
          <a href={`/events/${eventId}/check-in`}><strong>Check in</strong><span>Confirmed participants can mark attendance on matchday</span></a>
        </div>
      </section>
    </div>
  );
}
