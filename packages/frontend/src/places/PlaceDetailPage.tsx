import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PublicPlaceSummary } from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createEventApi, type EventRsvpState, type PublicEvent } from "../events/api";
import { HoomaApiError } from "../http";
import { FitSingleLineText } from "../ui/FitSingleLineText";
import {
  CalendarIcon,
  ChevronRightIcon,
  EditIcon,
  InfoIcon,
  MenuIcon,
  PhoneIcon,
  PinIcon,
  ShareIcon,
  UserPlusIcon,
  UsersIcon,
} from "../ui/HoomaIcons";
import { CulturalEventCard } from "../watch/CulturalEventCard";
import { WatchTicket } from "../watch/WatchTicket";
import { PlaceGallery } from "./PlaceGallery";
import { createPlatformManagementApi } from "./platform-management-api";

type ActiveRsvpState = "CONFIRMED" | "WAITLISTED" | "ATTENDED" | null;

function activeRsvp(status: EventRsvpState | undefined): ActiveRsvpState {
  return status === "CONFIRMED" || status === "WAITLISTED" || status === "ATTENDED" ? status : null;
}

function eventDateParts(event: PublicEvent): {
  date: string;
  time: string;
  day: string;
  month: string;
} {
  const startsAt = new Date(event.startsAt);
  const options = { timeZone: event.timezone } as const;
  try {
    return {
      date: new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        ...options,
      }).format(startsAt),
      time: new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        ...options,
      }).format(startsAt),
      day: new Intl.DateTimeFormat(undefined, { day: "2-digit", ...options }).format(startsAt),
      month: new Intl.DateTimeFormat("en-US", { month: "short", ...options })
        .format(startsAt)
        .slice(0, 3)
        .toUpperCase(),
    };
  } catch {
    return {
      date: startsAt.toLocaleDateString(undefined, {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
      time: startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
      day: String(startsAt.getDate()).padStart(2, "0"),
      month: startsAt.toLocaleDateString("en-US", { month: "short" }).slice(0, 3).toUpperCase(),
    };
  }
}

function mapHref(place: PublicPlaceSummary): string {
  const query =
    place.latitude != null && place.longitude != null
      ? `${place.latitude},${place.longitude}`
      : [place.address, place.houma, place.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function EventTeamMarks({ event }: { readonly event: PublicEvent }) {
  const details = event.watchDetails;
  if (details?.kind === "CULTURAL") {
    return (
      <span className="place-event-row__teams" aria-hidden="true">
        <span>{details.culturalCategory.slice(0, 1)}</span>
      </span>
    );
  }
  if (details?.kind !== "MATCH")
    return <span className="place-event-row__teams" aria-hidden="true" />;
  return (
    <span className="place-event-row__teams" aria-hidden="true">
      {details.teamOneLogoUrl ? <img src={details.teamOneLogoUrl} alt="" /> : <span />}
      {details.teamTwoLogoUrl ? <img src={details.teamTwoLogoUrl} alt="" /> : <span />}
    </span>
  );
}

export function PlaceDetailPage({ placeId }: { readonly placeId: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const management = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const eventsApi = useMemo(() => createEventApi(transport), [transport]);
  const [place, setPlace] = useState<PublicPlaceSummary | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(false);
  const [rsvp, setRsvp] = useState<ActiveRsvpState>(null);
  const [participationLoading, setParticipationLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const selectedEventId = new URLSearchParams(window.location.search).get("eventId");

  async function loadPlaceEvents(): Promise<PublicEvent[]> {
    const items: PublicEvent[] = [];
    let cursor: string | undefined;
    do {
      const page = await eventsApi.publicWatch({ placeId, cursor, limit: 100 });
      items.push(...page.items);
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    return items;
  }

  async function loadPlaceAndEvents() {
    const [row, placeEvents] = await Promise.all([
      management.places.get(placeId),
      loadPlaceEvents(),
    ]);
    setPlace(row);
    setEvents(placeEvents);
  }

  async function loadParticipation(eventId: string) {
    setParticipationLoading(true);
    try {
      const result = await eventsApi.myRsvp(eventId);
      setRsvp(activeRsvp(result.rsvp?.status));
    } catch (reason) {
      if (reason instanceof HoomaApiError && reason.status === 401) setRsvp(null);
      else setError(reason instanceof Error ? reason.message : "Unable to load RSVP state");
    } finally {
      setParticipationLoading(false);
    }
  }

  useEffect(() => {
    void loadPlaceAndEvents().catch((reason) =>
      setError(reason instanceof Error ? reason.message : "Unable to load Place"),
    );
    void management.places
      .manage(placeId)
      .then(() => setCanManage(true))
      .catch((reason) => {
        if (reason instanceof HoomaApiError && [401, 403].includes(reason.status)) return;
      });
  }, [eventsApi, management, placeId]);

  useEffect(() => {
    if (selectedEventId) void loadParticipation(selectedEventId);
    else setRsvp(null);
  }, [selectedEventId]);

  async function joinSelectedEvent() {
    if (!selectedEventId || actionPending) return;
    setActionPending(true);
    setError("");
    setMessage("");
    try {
      const result = await eventsApi.join(selectedEventId);
      setRsvp(result.status);
      setMessage(result.status === "WAITLISTED" ? "Added to the waitlist." : "You are going.");
      await loadPlaceAndEvents();
    } catch (reason) {
      setError(protectedError(reason, "Unable to join event"));
    } finally {
      setActionPending(false);
    }
  }

  async function leaveSelectedEvent() {
    if (!selectedEventId || actionPending) return;
    setActionPending(true);
    setError("");
    setMessage("");
    try {
      await eventsApi.cancelRsvp(selectedEventId);
      setRsvp(null);
      setMessage("RSVP cancelled.");
      await loadPlaceAndEvents();
    } catch (reason) {
      setError(protectedError(reason, "Unable to leave event"));
    } finally {
      setActionPending(false);
    }
  }

  async function shareSelectedEvent() {
    if (!selectedEventId) return;
    const url = new URL(`/events/${selectedEventId}`, window.location.origin).toString();
    const selected = events.find((event) => event.id === selectedEventId);
    try {
      if (navigator.share) {
        await navigator.share({ title: selected?.title ?? "HOOMA Watch event", url });
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("Event link copied.");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError(reason instanceof Error ? reason.message : "Unable to share event");
    }
  }

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setMessage("");
    try {
      await management.places.claimOwnership(placeId, {
        evidence: String(data.get("evidence") ?? ""),
      });
      setMessage("Ownership claim submitted to the App Admin.");
      setClaimOpen(false);
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit ownership claim"));
    }
  }

  async function deletePlace() {
    if (deleting || !place) return;
    if (
      !window.confirm(
        `Delete ${place.name}? It will disappear from active Places and Watch surfaces while historical records are preserved.`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      await management.places.archive(placeId);
      window.location.href = "/places";
    } catch (reason) {
      setError(protectedError(reason, "Unable to delete Place"));
      setDeleting(false);
    }
  }

  if (!place)
    return error ? <p className="error">{error}</p> : <p className="status">Loading Place…</p>;

  const selectedEvent = selectedEventId
    ? (events.find((event) => event.id === selectedEventId) ?? null)
    : null;
  const selectedDate = selectedEvent ? eventDateParts(selectedEvent) : null;
  const visibleMenuItems = menuExpanded ? place.menuItems : place.menuItems.slice(0, 5);
  const visibleEvents = eventsExpanded ? events : events.slice(0, 2);
  const eventOpen = selectedEvent?.status !== "COMPLETED";
  const isGoing = rsvp === "CONFIRMED" || rsvp === "WAITLISTED";
  const hasContact = Boolean(place.phone || place.email || place.websiteUrl);

  return (
    <section className="place-detail-page">
      <div className="place-detail-toolbar">
        <a className="place-back-link" href="/watch" aria-label="Back to Watch">
          ← Watch
        </a>
        {canManage ? (
          <a className="place-owner-edit" href={`/places/${place.id}/edit`}>
            <EditIcon size={17} />
            Edit Place
          </a>
        ) : null}
      </div>

      {selectedEvent?.watchDetails?.kind === "CULTURAL" ? (
        <CulturalEventCard event={selectedEvent} />
      ) : selectedEvent ? (
        <WatchTicket event={selectedEvent} variant="place-detail" />
      ) : null}

      <section className="place-detail-hero place-detail-hero--copy-only">
        <div className="place-detail-hero__copy">
          {place.category ? <p className="place-detail-category">{place.category}</p> : null}
          <h1>{place.name}</h1>
          <p className="place-detail-description">
            {place.description || "Watch together at this HOOMA Place."}
          </p>

          {selectedEvent && selectedDate ? (
            <div className="place-event-summary">
              <span>
                <UsersIcon /> <strong>{selectedEvent._count.rsvps}</strong> going
              </span>
              <span className="place-event-summary__divider" aria-hidden="true" />
              <span>
                <CalendarIcon /> {selectedDate.date} · {selectedDate.time}
              </span>
              <span className="place-event-summary__divider" aria-hidden="true" />
              <span>
                {selectedEvent.venueAuthority === "OFFICIAL_VENUE"
                  ? "Official venue"
                  : "Suggested by community"}
              </span>
            </div>
          ) : null}

          {selectedEvent ? (
            <div className="place-watch-actions">
              {rsvp === "ATTENDED" ? (
                <div className="place-watch-action place-watch-action--joined">Checked in</div>
              ) : isGoing ? (
                <button
                  type="button"
                  className="place-watch-action place-watch-action--primary"
                  disabled={actionPending}
                  onClick={() => void leaveSelectedEvent()}
                >
                  <UserPlusIcon />
                  {actionPending
                    ? "Updating…"
                    : rsvp === "WAITLISTED"
                      ? "Leave waitlist"
                      : "Cancel RSVP"}
                </button>
              ) : eventOpen ? (
                <button
                  type="button"
                  className="place-watch-action place-watch-action--primary"
                  disabled={actionPending || participationLoading}
                  onClick={() => void joinSelectedEvent()}
                >
                  <UserPlusIcon />
                  {actionPending ? "Joining…" : "Join event"}
                </button>
              ) : null}
              <button
                type="button"
                className="place-watch-action place-watch-action--secondary"
                onClick={() => void shareSelectedEvent()}
              >
                <ShareIcon />
                Share event
              </button>
            </div>
          ) : (
            <div className="place-detail-secondary-links">
              {place.phone ? (
                <a href={`tel:${place.phone}`}>
                  <PhoneIcon size={18} /> Call
                </a>
              ) : null}
              {place.websiteUrl ? (
                <a href={place.websiteUrl} target="_blank" rel="noreferrer">
                  Website
                </a>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <div className="place-info-grid">
        <article>
          <div className="place-info-card__heading">
            <PinIcon />
            <span>Address</span>
          </div>
          <strong>{place.address}</strong>
          {place.city ? <span className="place-info-card__secondary">{place.city}</span> : null}
        </article>
        <article>
          <div className="place-info-card__heading">
            <PinIcon />
            <span>Houma</span>
          </div>
          <strong>{place.houma || "—"}</strong>
          <a
            className="place-info-card__action"
            href={mapHref(place)}
            target="_blank"
            rel="noreferrer"
          >
            View on map
          </a>
        </article>
        <article>
          <div className="place-info-card__heading">
            <PhoneIcon />
            <span>Contact</span>
          </div>
          {hasContact ? (
            <div className="place-info-values">
              {place.phone ? <a href={`tel:${place.phone}`}>{place.phone}</a> : null}
              {place.email ? <a href={`mailto:${place.email}`}>{place.email}</a> : null}
              {place.websiteUrl ? (
                <a href={place.websiteUrl} target="_blank" rel="noreferrer">
                  Website
                </a>
              ) : null}
            </div>
          ) : (
            <strong>—</strong>
          )}
          {place.phone ? (
            <a className="place-info-card__action" href={`tel:${place.phone}`}>
              <PhoneIcon size={16} /> Call
            </a>
          ) : null}
        </article>
        <article>
          <div className="place-info-card__heading">
            <InfoIcon />
            <span>About</span>
          </div>
          <strong>{place.description || "—"}</strong>
        </article>
      </div>

      <PlaceGallery place={place} />

      {place.menuItems.length ? (
        <section className="place-menu-section" id="place-menu">
          <div className="place-section-heading">
            <h2>
              <MenuIcon /> Menu
            </h2>
            {place.menuItems.length > 5 ? (
              <button type="button" onClick={() => setMenuExpanded((value) => !value)}>
                {menuExpanded ? "Show less" : "View full menu"}
                <ChevronRightIcon size={18} />
              </button>
            ) : null}
          </div>
          <div className="place-menu-preview">
            {visibleMenuItems.map((item) => (
              <article key={item.id}>
                <MenuIcon size={22} />
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.price} {item.currency}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="place-events-section">
        <div className="place-section-heading">
          <h2>
            <CalendarIcon /> Upcoming Watch events at this place
          </h2>
          {events.length > 2 ? (
            <button type="button" onClick={() => setEventsExpanded((value) => !value)}>
              {eventsExpanded ? "Show less" : "View all"}
              <ChevronRightIcon size={18} />
            </button>
          ) : null}
        </div>
        <div className="place-event-list">
          {visibleEvents.map((event) => {
            const date = eventDateParts(event);
            const details = event.watchDetails;
            const match = details?.kind === "MATCH" ? details : null;
            return (
              <a className="place-event-row" key={event.id} href={`/events/${event.id}`}>
                <span className="place-event-row__date">
                  <small>{date.month}</small>
                  <strong>{date.day}</strong>
                </span>
                <EventTeamMarks event={event} />
                <span className="place-event-row__match">
                  {match ? (
                    <span className="place-event-row__matchup">
                      <FitSingleLineText
                        className="place-event-row__team-name place-event-row__team-name--one"
                        text={match.teamOneName}
                        minFontSize={10}
                        maxFontSize={24}
                      />
                      <small>VS</small>
                      <FitSingleLineText
                        className="place-event-row__team-name place-event-row__team-name--two"
                        text={match.teamTwoName}
                        minFontSize={10}
                        maxFontSize={24}
                      />
                    </span>
                  ) : (
                    <FitSingleLineText
                      className="place-event-row__legacy-title"
                      text={event.title}
                      minFontSize={11}
                      maxFontSize={20}
                    />
                  )}
                </span>
                <span className="place-event-row__attendance">
                  <UsersIcon size={18} />
                  <strong>{event._count.rsvps}</strong> going
                </span>
                <span className="place-event-row__time">{date.time}</span>
                <ChevronRightIcon className="place-event-row__chevron" />
              </a>
            );
          })}
          {!events.length ? <p className="muted">No upcoming Watch events yet.</p> : null}
        </div>
      </section>

      {canManage ? (
        <details className="place-owner-tools">
          <summary>Place management</summary>
          <div>
            <a href={`/places/${place.id}/edit`}>
              <EditIcon size={16} /> Edit Place
            </a>
            <a
              href={`/events/new?type=WATCH&kind=CULTURAL&placeId=${encodeURIComponent(place.id)}`}
            >
              Create Cultural Event
            </a>
            <button type="button" disabled={deleting} onClick={() => void deletePlace()}>
              {deleting ? "Deleting…" : "Delete Place"}
            </button>
          </div>
        </details>
      ) : (
        <section className="place-claim-section">
          <button
            type="button"
            className="place-claim-toggle"
            onClick={() => setClaimOpen((value) => !value)}
          >
            Own/manage this place?
          </button>
          {claimOpen ? (
            <form className="panel place-claim-form" onSubmit={(event) => void claim(event)}>
              <label>
                Ownership or management evidence
                <textarea name="evidence" minLength={10} required />
              </label>
              <button type="submit">Submit ownership claim</button>
            </form>
          ) : null}
        </section>
      )}

      {message ? <p className="status">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
