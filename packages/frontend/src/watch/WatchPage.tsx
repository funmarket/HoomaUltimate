import { useEffect, useMemo, useState } from "react";
import type { PublicPlaceCapability, PublicPlaceSummary } from "@hooma/contracts/platform-management";
import { WATCH_COLLECTOR_TICKET_MASTER } from "@hooma/ui";
import { useHoomaFrontend } from "../context";
import type { PublicEvent } from "../events/api";
import { useEventApi } from "../events/useEventApi";
import { PlaceCapabilityOnboarding } from "../places/PlaceCapabilityOnboarding";
import { createPlatformManagementApi } from "../places/platform-management-api";

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function placeLocation(place: PublicPlaceSummary): string {
  return [place.city, place.houma].filter(Boolean).join(" · ") || place.address;
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
  const venue = event.venueName || "Venue to be confirmed";
  const location = event.address || event.community.name;

  return (
    <article className="watch-ticket" aria-label={`${event.title}, ${date} at ${time}`}>
      <img
        className="watch-ticket__master"
        src={WATCH_COLLECTOR_TICKET_MASTER.src}
        width={WATCH_COLLECTOR_TICKET_MASTER.width}
        height={WATCH_COLLECTOR_TICKET_MASTER.height}
        alt=""
        aria-hidden="true"
      />
      <span className="watch-ticket__series">COLLECTOR SERIES</span>
      <div className="watch-ticket__event-title" title={event.title}>
        {event.title}
      </div>
      <div className="watch-ticket__venue" title={venue}>
        <strong>{venue}</strong>
        <span>{location}</span>
      </div>
      <div className="watch-ticket__date">
        <strong>{date}</strong>
        <span>{time}</span>
      </div>
      <div className="watch-ticket__going">
        <strong>{event._count.rsvps}</strong>
        <span>going</span>
      </div>
      <span className="watch-ticket__status">WATCH EVENT</span>
      <div className="watch-ticket__stub" aria-hidden="true">
        <strong>{event.title}</strong>
        <span>{date}</span>
      </div>
    </article>
  );
}

function WatchPlaceCard({ item }: { readonly item: PublicPlaceCapability }) {
  return (
    <article className="watch-place-card">
      <div>
        <span className="eyebrow">APPROVED WATCH PLACE</span>
        <h3>{item.place.name}</h3>
        <p>{item.summary}</p>
      </div>
      <dl>
        <div>
          <dt>Location</dt>
          <dd>{placeLocation(item.place)}</dd>
        </div>
        <div>
          <dt>Address</dt>
          <dd>{item.place.address}</dd>
        </div>
      </dl>
      <div className="watch-place-card__actions">
        {item.place.phone ? <a href={`tel:${item.place.phone}`}>Call</a> : null}
        {item.place.websiteUrl ? (
          <a href={item.place.websiteUrl} target="_blank" rel="noreferrer">
            Website
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function WatchPage() {
  const eventApi = useEventApi();
  const { transport } = useHoomaFrontend();
  const managementApi = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [places, setPlaces] = useState<PublicPlaceSummary[]>([]);
  const [watchPlaces, setWatchPlaces] = useState<PublicPlaceCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [houma, setHouma] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void Promise.all([
      eventApi.publicWatch(),
      managementApi.places.list(),
      managementApi.capability.list("WATCH"),
    ])
      .then(([eventPage, placeRows, capabilityRows]) => {
        if (!active) return;
        setEvents(eventPage.items);
        setPlaces(placeRows);
        setWatchPlaces(capabilityRows);
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
  }, [eventApi, managementApi]);

  const cities = useMemo(
    () =>
      [...new Set(watchPlaces.map((item) => item.place.city).filter((value): value is string => Boolean(value)))].sort(),
    [watchPlaces],
  );
  const houmas = useMemo(
    () =>
      [...new Set(watchPlaces.map((item) => item.place.houma).filter((value): value is string => Boolean(value)))].sort(),
    [watchPlaces],
  );

  const filteredEvents = useMemo(() => {
    const needle = normalize(query);
    const cityNeedle = normalize(city);
    const houmaNeedle = normalize(houma);
    return events.filter((event) => {
      const eventSearch = normalize(
        [event.title, event.venueName, event.address, event.community.name].filter(Boolean).join(" "),
      );
      if (needle && !eventSearch.includes(needle)) return false;
      if (cityNeedle && !eventSearch.includes(cityNeedle)) return false;
      if (houmaNeedle && !eventSearch.includes(houmaNeedle)) return false;
      return true;
    });
  }, [city, events, houma, query]);

  const filteredWatchPlaces = useMemo(() => {
    const needle = normalize(query);
    return watchPlaces.filter((item) => {
      if (city && item.place.city !== city) return false;
      if (houma && item.place.houma !== houma) return false;
      if (!needle) return true;
      return normalize(
        [item.place.name, item.place.city, item.place.houma, item.place.address, item.summary]
          .filter(Boolean)
          .join(" "),
      ).includes(needle);
    });
  }, [city, houma, query, watchPlaces]);

  return (
    <section className="watch-page">
      <header className="watch-hero">
        <div>
          <span className="eyebrow">MATCH NIGHT</span>
          <h1>Watch</h1>
          <p>Watch together. Find the match. Find the crowd.</p>
        </div>
        <button
          className="watch-create-action"
          type="button"
          disabled
          title="Watch event creation is being connected to canonical Places"
        >
          <span aria-hidden="true">＋</span>
          Create watch event
        </button>
      </header>

      <div className="watch-discovery-controls">
        <label className="watch-search">
          <span className="sr-only">Search Watch events or venues</span>
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search events or venues"
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

      <section className="watch-event-section" aria-labelledby="watch-events-title">
        <div className="watch-section-heading">
          <div>
            <span className="eyebrow">COLLECTOR SERIES</span>
            <h2 id="watch-events-title">Upcoming watch events</h2>
          </div>
          <span>{filteredEvents.length}</span>
        </div>
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
            <strong>No Watch events match yet.</strong>
            <p>
              Approved Watch venues remain available below while Watch event publishing is connected
              to canonical Places.
            </p>
          </div>
        ) : null}
      </section>

      <section className="watch-places-section" aria-labelledby="watch-places-title">
        <div className="watch-section-heading">
          <div>
            <span className="eyebrow">WATCH PLACES</span>
            <h2 id="watch-places-title">Places built for match night</h2>
          </div>
          <span>{filteredWatchPlaces.length}</span>
        </div>
        <div className="watch-place-grid">
          {filteredWatchPlaces.map((item) => (
            <WatchPlaceCard key={item.id} item={item} />
          ))}
        </div>
        {!loading && !filteredWatchPlaces.length && !error ? (
          <p className="muted">No approved Watch places match these filters.</p>
        ) : null}
      </section>

      <details className="watch-business-entry">
        <summary>
          <span>
            <strong>List or manage a Watch venue</strong>
            <small>Place ownership and App review remain required.</small>
          </span>
          <span aria-hidden="true">＋</span>
        </summary>
        <div className="watch-business-entry__body">
          <PlaceCapabilityOnboarding kind="WATCH" places={places} />
        </div>
      </details>
    </section>
  );
}
