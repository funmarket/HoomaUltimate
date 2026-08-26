import { useEffect, useMemo, useState } from "react";
import type { PublicEvent } from "../events/api";
import { useEventApi } from "../events/useEventApi";
import { WatchTicket } from "./WatchTicket";

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
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
