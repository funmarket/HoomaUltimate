import { useEffect, useMemo, useState } from "react";
import type { WatchEventKind } from "@hooma/contracts";
import type { PublicEvent } from "../events/api";
import { useEventApi } from "../events/useEventApi";
import { CalendarIcon, PinIcon } from "../ui/HoomaIcons";
import { CulturalEventCard } from "./CulturalEventCard";
import { WatchTicket } from "./WatchTicket";

function normalize(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function watchKind(event: PublicEvent): WatchEventKind {
  return event.watchDetails?.kind === "CULTURAL" ? "CULTURAL" : "MATCH";
}

type TimeGroup = "Today" | "Tomorrow" | "This Week" | "Later";

function groupForEvent(event: PublicEvent): TimeGroup {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const afterTomorrow = new Date(today);
  afterTomorrow.setDate(today.getDate() + 2);
  const nextWeek = new Date(today);
  nextWeek.setDate(today.getDate() + 7);
  const startsAt = new Date(event.startsAt);
  if (startsAt < tomorrow) return "Today";
  if (startsAt < afterTomorrow) return "Tomorrow";
  if (startsAt < nextWeek) return "This Week";
  return "Later";
}

const timeGroupOrder: readonly TimeGroup[] = ["Today", "Tomorrow", "This Week", "Later"];

export function WatchPage() {
  const eventApi = useEventApi();
  const initialKind: WatchEventKind =
    new URLSearchParams(window.location.search).get("kind") === "CULTURAL" ? "CULTURAL" : "MATCH";
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<WatchEventKind>(initialKind);
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
        if (!active) return;
        setEvents(page.items);
        setNextCursor(page.nextCursor);
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

  const visibleKindEvents = useMemo(
    () => events.filter((event) => watchKind(event) === kind),
    [events, kind],
  );

  const cities = useMemo(
    () =>
      [
        ...new Set(
          visibleKindEvents
            .map((event) => event.place?.city)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [visibleKindEvents],
  );
  const houmas = useMemo(
    () =>
      [
        ...new Set(
          visibleKindEvents
            .map((event) => event.place?.houma)
            .filter((value): value is string => Boolean(value)),
        ),
      ].sort(),
    [visibleKindEvents],
  );

  const filteredEvents = useMemo(() => {
    const needle = normalize(query);
    return visibleKindEvents.filter((event) => {
      if (!event.place) return false;
      if (city && event.place.city !== city) return false;
      if (houma && event.place.houma !== houma) return false;
      if (!needle) return true;
      const culturalCategory =
        event.watchDetails?.kind === "CULTURAL" ? event.watchDetails.culturalCategory : null;
      return normalize(
        [
          event.title,
          event.description,
          culturalCategory,
          event.place.name,
          event.place.address,
          event.place.city,
          event.place.houma,
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(needle);
    });
  }, [city, houma, query, visibleKindEvents]);

  const groups = useMemo(() => {
    const grouped = new Map<TimeGroup, PublicEvent[]>();
    for (const event of filteredEvents) {
      const label = groupForEvent(event);
      const group = grouped.get(label) ?? [];
      group.push(event);
      grouped.set(label, group);
    }
    return grouped;
  }, [filteredEvents]);

  function selectKind(nextKind: WatchEventKind) {
    setKind(nextKind);
    setCity("");
    setHouma("");
    const url = new URL(window.location.href);
    if (nextKind === "MATCH") url.searchParams.delete("kind");
    else url.searchParams.set("kind", nextKind);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError("");
    try {
      const page = await eventApi.publicWatch({ cursor: nextCursor });
      setEvents((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load more Watch events");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="watch-page">
      <header className="watch-hero">
        <div>
          <h1>Watch</h1>
          <p>Watch together. Find the match, the culture and the crowd.</p>
        </div>
      </header>

      <nav className="watch-section-actions" aria-label="Watch sections">
        <a className="watch-section-action" href="/watch" aria-current="page">
          <CalendarIcon size={28} className="watch-section-action__icon" />
          <span>Events</span>
        </a>
        <a className="watch-section-action" href="/places">
          <PinIcon size={28} className="watch-section-action__icon" />
          <span>Spots</span>
        </a>
        <a className="watch-section-action" href={`/events/new?type=WATCH&kind=${kind}`}>
          <CalendarIcon size={28} className="watch-section-action__icon" />
          <span>Create Event</span>
        </a>
        <a className="watch-section-action" href="/places/new">
          <PinIcon size={28} className="watch-section-action__icon" />
          <span>Add a Place</span>
        </a>
      </nav>

      <div className="watch-kind-tabs" role="tablist" aria-label="Watch event categories">
        <button
          type="button"
          role="tab"
          aria-selected={kind === "MATCH"}
          className={kind === "MATCH" ? "watch-kind-tab is-active" : "watch-kind-tab"}
          onClick={() => selectKind("MATCH")}
        >
          Match
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={kind === "CULTURAL"}
          className={kind === "CULTURAL" ? "watch-kind-tab is-active" : "watch-kind-tab"}
          onClick={() => selectKind("CULTURAL")}
        >
          Cultural
        </button>
      </div>

      <div className="watch-discovery-controls">
        <label className="watch-search">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            aria-label="Search Watch events or venues"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={
              kind === "MATCH"
                ? "Search matches, teams or venues"
                : "Search cultural events or venues"
            }
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
      {!loading && filteredEvents.length
        ? timeGroupOrder.map((label) => {
            const items = groups.get(label);
            if (!items?.length) return null;
            return (
              <section className="watch-time-group" key={label}>
                <h2 className="watch-time-group__heading">{label}</h2>
                <div className="watch-time-group__items">
                  {items.map((event) =>
                    kind === "MATCH" ? (
                      <WatchTicket key={event.id} event={event} />
                    ) : (
                      <CulturalEventCard key={event.id} event={event} />
                    ),
                  )}
                </div>
              </section>
            );
          })
        : null}
      {!loading && nextCursor ? (
        <button
          type="button"
          className="watch-load-more"
          disabled={loadingMore}
          onClick={() => void loadMore()}
        >
          {loadingMore ? "Loading…" : "Load more events"}
        </button>
      ) : null}
      {!loading && !filteredEvents.length && !error ? (
        <div className="watch-empty-state">
          <div className="watch-empty-state__icon" aria-hidden="true">
            ◫
          </div>
          <strong>No {kind === "MATCH" ? "match" : "cultural"} events yet.</strong>
          <p>New Watch events across HOOMA will appear here.</p>
        </div>
      ) : null}
    </section>
  );
}
