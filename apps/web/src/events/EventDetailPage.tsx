import { useEffect, useState } from "react";
import { eventApi, type PublicEvent } from "../api/event-client";

export function EventDetailPage({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { void reload(); }, [eventId]);
  async function reload() { setEvent(await eventApi.publicDetail(eventId)); }
  async function action(run: () => Promise<unknown>, message: string) { setError(""); try { await run(); setStatus(message); await reload(); } catch (reason) { const error = reason as Error & { code?: string }; if (error.code === "AUTH_REQUIRED") window.location.href = `/login?returnTo=${encodeURIComponent(window.location.pathname)}`; else setError(error.message); } }
  if (!event) return error ? <p className="error">{error}</p> : <p className="status">Loading event…</p>;
  return <section className="event-detail"><p className="eyebrow">{event.type}</p><h2>{event.title}</h2><p>{event.description}</p><div className="panel event-meta"><div><span>When</span><strong>{new Date(event.startsAt).toLocaleString()}</strong></div><div><span>Where</span><strong>{event.venueName || event.address || "To be confirmed"}</strong></div><div><span>Players</span><strong>{event._count.rsvps}{event.capacity ? ` / ${event.capacity}` : ""}</strong></div><div><span>Format</span><strong>{event.playDetails?.format?.replaceAll("_", " ") || "—"}</strong></div></div><div className="event-actions"><button type="button" onClick={() => void action(() => eventApi.join(eventId), "RSVP saved.")}>Join game</button><button type="button" onClick={() => void action(() => eventApi.cancelRsvp(eventId), "RSVP cancelled.")}>Leave game</button><a href={`/events/${eventId}/formation`}>Formation</a><a href={`/events/${eventId}/chat`}>Event chat</a><a href={`/events/${eventId}/check-in`}>Check in</a></div>{status ? <p className="success">{status}</p> : null}{error ? <p className="error">{error}</p> : null}</section>;
}
