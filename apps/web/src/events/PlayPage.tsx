import { useEffect, useState } from "react";
import { eventApi, type PublicEvent } from "../api/event-client";

export function PlayPage() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { void eventApi.publicPlay().then((page) => setEvents(page.items)).catch((reason: Error) => setError(reason.message)); }, []);
  return <section><p className="eyebrow">PLAY</p><div className="section-heading"><div><h2>Find the next game</h2><p>Public games stay browsable. Sign in only when you join or manage one.</p></div><a className="admin-link" href="/events/new">Create game</a></div>{error ? <p className="error">{error}</p> : null}<div className="event-list">{events.map((event) => <a className="event-card" href={`/events/${event.id}`} key={event.id}><div><span className="event-card__date">{formatDate(event.startsAt)}</span><strong>{event.title}</strong><span>{event.community.name}</span></div><div><span>{event.playDetails?.format?.replaceAll("_", " ")}</span><small>{event._count.rsvps}{event.capacity ? ` / ${event.capacity}` : ""} going</small></div></a>)}</div>{!events.length && !error ? <p className="status">No upcoming Play events yet.</p> : null}</section>;
}
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
