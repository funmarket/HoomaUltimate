import { useEffect, useMemo, useState } from "react";
import { WATCH_COLLECTOR_TICKET_MASTER } from "@hooma/ui";
import type { PublicEvent } from "../events/api";
import { useEventApi } from "../events/useEventApi";

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function eventDateParts(event: PublicEvent): { date: string; time: string } {
  const startsAt = new Date(event.startsAt);
  try {
    return {
      date: new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        timeZone: event.timezone,
      }).format(startsAt),
      time: new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: event.timezone,
      }).format(startsAt),
    };
  } catch {
    return {
      date: startsAt.toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
      time: startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    };
  }
}

function WatchTicket({ event }: { readonly event: PublicEvent }) {
  const { date, time } = eventDateParts(event);
  const place = event.place;
  if (!place) return null;
  const location =
    [place.city, place.houma ? `Houma: ${place.houma}` : null].filter(Boolean).join(", ") ||
    place.address;
  const status =
    event.venueAuthority === "OFFICIAL_VENUE" ? "OFFICIAL VENUE" : "SUGGESTED BY COMMUNITY";

  return (
    <article
      className="watch-ticket"
      aria-label={`${event.title}, ${place.name}, ${date} at ${time}`}
    >
      <img
        className="watch-ticket__master"
        src={WATCH_COLLECTOR_TICKET_MASTER.src}
        width={WATCH_COLLECTOR_TICKET_MASTER.width}
        height={WATCH_COLLECTOR_TICKET_MASTER.height}
        alt=""
        aria-hidden="true"
      />
      <a
        className="watch-ticket__place-photo"
        href={`/places/${place.id}`}
        aria-label={`Open ${place.name}`}
      >
        {place.imageUrl ? <img src={place.imageUrl} alt={place.name} /> : <span>{place.name}</span>}
      </a>
      <span className="watch-ticket__series">COLLECTOR SERIES</span>
      <a className="watch-ticket__event-title" href={`/events/${event.id}`} title={event.title}>
        {event.title}
      </a>
      <a className="watch-ticket__venue" href={`/places/${place.id}`} title={place.name}>
        <strong>{place.name}</strong>
        <span>{location}</span>
      </a>
      <div className="watch-ticket__date">
        <strong>{date}</strong>
        <span>{time}</span>
      </div>
      <div className="watch-ticket__going">
        <strong>{event._count.rsvps}</strong>
        <span>going</span>
      </div>
      <span className="watch-ticket__status">{status}</span>
      <a
        className="watch-ticket__stub"
        href={`/events/${event.id}`}
        aria-label={`Open ${event.title}`}
      >
        <strong>{event.title}</strong>
        <span>{date}</span>
      </a>
    </article>
  );
}

export function WatchPage() {
  const eventApi = useEventApi();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [houma, setHouma] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void eventApi
      .publicWatch()
      .then((page) => {
        if (active) setEvents(page.items);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load Watch");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [eventApi]);

  const cities = useMemo(
    () =>
      [
        ...new Set(
          events
            .map((event) => event.place?.city)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [events],
  );
  const houmas = useMemo(
    () =>
      [
        ...new Set(
          events
            .map((event) => event.place?.houma)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const needle = normalize(query);
    return events.filter((event) => {
      if (!event.place) return false;
      if (city && event.place.city !== city) return false;
      if (houma && event.place.houma !== houma) return false;
      if (!needle) return true;
      return normalize(
        [
          event.title,
          event.description,
          event.place.name,
          event.place.address,
          event.place.city,
          event.place.houma,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(needle);
    });
  }, [city, events, houma, query]);

  return (
    <section className="watch-page">
      <header className="watch-hero">
        <div>
          <h1>Watch</h1>
          <p>Watch together. Find the match. Find the crowd.</p>
        </div>
      </header>

      <nav className="watch-actions" aria-label="Watch sections">
        <a className="watch-action watch-action--active" href="/watch">
          Events
        </a>
        <a className="watch-action" href="/places">
          Places
        </a>
        <a className="watch-action watch-action--primary" href="/events/new?type=WATCH">
          Create Event
        </a>
        <a className="watch-action" href="/places/new">
          Add a Place
        </a>
      </nav>

      <div className="watch-discovery-controls">
        <label className="watch-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            aria-label="Search Watch events, teams or venues"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events, teams or venues"
          />
        </label>
        <div className="watch-location-filters">
          <label>
            <span>City</span>
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">All cities</option>
              {cities.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Houma</span>
            <select value={houma} onChange={(event) => setHouma(event.target.value)}>
              <option value="">All Houmas</option>
              {houmas.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="status">Loading Watch events…</p> : null}
      {!loading && filteredEvents.length ? (
        <div className="watch-ticket-list">
          {filteredEvents.map((event) => (
            <WatchTicket key={event.id} event={event} />
          ))}
        </div>
      ) : null}
      {!loading && !filteredEvents.length && !error ? (
        <div className="watch-empty-state">
          <div className="watch-empty-state__icon" aria-hidden="true">
            ◫
          </div>
          <strong>No watch events yet.</strong>
          <p>New watch events across HOOMA will appear here.</p>
        </div>
      ) : null}
    </section>
  );
}
