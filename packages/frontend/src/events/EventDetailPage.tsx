import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useHoomaFrontend } from "../context";
import { HoomaApiError } from "../http";
import { EventWhistleBoard } from "../whistle/HoomaWhistleBoard";
import type { EventRsvpState, PublicEvent } from "./api";
import { useEventApi } from "./useEventApi";
import { createPlayApi } from "./play-api";

type ActiveRsvpState = "CONFIRMED" | "WAITLISTED" | "ATTENDED" | null;
type IconProps = { readonly color?: string };

function activeRsvp(status: EventRsvpState | undefined): ActiveRsvpState {
  return status === "CONFIRMED" || status === "WAITLISTED" || status === "ATTENDED" ? status : null;
}

function pretty(value: string | null | undefined): string {
  return value
    ? value
        .replaceAll("_", " ")
        .toLowerCase()
        .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())
    : "—";
}

function CalendarIcon({ color }: IconProps = {}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
      <rect x="4" y="5.5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M7.5 3.5v4M16.5 3.5v4M4 9h16"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function PinIcon({ color }: IconProps = {}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
      <path
        d="M12 21s6.3-5.3 6.3-11A6.3 6.3 0 1 0 5.7 10C5.7 15.7 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function UsersIcon({ color }: IconProps = {}) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={color ? { color } : undefined}
    >
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.65" />
      <circle cx="16.5" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.45" />
      <path
        d="M3.8 19c.45-4 2.2-6 5.2-6s4.75 2 5.2 6M14.1 14.2c2.65.1 4.3 1.7 4.8 4.8"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinecap="round"
      />
    </svg>
  );
}
function BallIcon() {
  return (
    <span aria-hidden="true" style={{ fontSize: "44px", lineHeight: 1 }}>
      ⚽
    </span>
  );
}

const playYellow = "#f2c94c";
const confirmedPistachio = "#d7ff8a";

export function EventDetailPage({ eventId }: { readonly eventId: string }) {
  const eventApi = useEventApi();
  const { transport, protectedError } = useHoomaFrontend();
  const playApi = useMemo(() => createPlayApi(transport), [transport]);
  const [event, setEvent] = useState<PublicEvent | null>(null);
  const [rsvp, setRsvp] = useState<ActiveRsvpState>(null);
  const [canManage, setCanManage] = useState(false);
  const [participationLoading, setParticipationLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void reloadEvent();
    void reloadParticipation();
    void eventApi
      .manage(eventId)
      .then(() => setCanManage(true))
      .catch((reason) => {
        if (reason instanceof HoomaApiError && [401, 403].includes(reason.status)) return;
      });
  }, [eventApi, eventId, playApi, protectedError]);

  async function reloadEvent() {
    try {
      setEvent(await eventApi.publicDetail(eventId));
      return;
    } catch (reason) {
      if (!(reason instanceof HoomaApiError) || reason.status !== 404) {
        setError(reason instanceof Error ? reason.message : "Unable to load event");
        return;
      }
    }

    try {
      setEvent(await playApi.matchDetail(eventId));
    } catch (reason) {
      if (reason instanceof HoomaApiError && reason.status === 401) {
        setError(protectedError(reason, "Sign in to view this Play match"));
        return;
      }
      setError(reason instanceof Error ? reason.message : "Unable to load event");
    }
  }

  async function reloadParticipation() {
    setParticipationLoading(true);
    try {
      const result = await eventApi.myRsvp(eventId);
      setRsvp(activeRsvp(result.rsvp?.status));
    } catch (reason) {
      if (reason instanceof HoomaApiError && reason.status === 401) setRsvp(null);
      else setError(reason instanceof Error ? reason.message : "Unable to load RSVP state");
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
      setError(protectedError(reason, "Unable to join event"));
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
      setError(protectedError(reason, "Unable to leave event"));
    } finally {
      setActionPending(false);
    }
  }

  if (!event)
    return error ? <p className="error">{error}</p> : <p className="status">Loading event…</p>;

  const eventOpen = event.status !== "COMPLETED";
  const isWatch = event.type === "WATCH";
  const location = isWatch
    ? event.place?.name || "Place to be confirmed"
    : event.place?.name || event.venueName || event.address || "Venue to be confirmed";
  const play = event.playDetails;
  const rsvpLabel =
    rsvp === "WAITLISTED"
      ? "WAITLISTED"
      : rsvp === "CONFIRMED"
        ? "CONFIRMED"
        : rsvp === "ATTENDED"
          ? "CHECKED IN"
          : null;
  const startsAt = new Date(event.startsAt);
  const watchDate = startsAt.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const watchTime = startsAt.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const watchArea = [event.place?.houma, event.place?.city]
    .filter((value): value is string => Boolean(value))
    .join(" · ");
  const watchAuthority =
    event.publisherAuthority === "VERIFIED_PLACE_OWNER"
      ? "Published by venue"
      : "Community-published";

  return (
    <div className="play-event-page">
      {isWatch ? (
        <section className="watch-event-detail">
          <div className="watch-event-detail__kicker">Watch event</div>

          <div className="watch-event-detail__title-row">
            <div className="watch-event-detail__title-copy">
              <h1>{event.title}</h1>
              {event.description ? (
                <p className="watch-event-detail__subtitle">{event.description}</p>
              ) : null}
            </div>
          </div>

          <div className="watch-event-detail__meta" aria-label="Event essentials">
            <div className="watch-event-detail__meta-item watch-event-detail__meta-item--date">
              <CalendarIcon />
              <span>
                <strong>{watchDate}</strong>
                <small>{watchTime}</small>
              </span>
            </div>
            <div className="watch-event-detail__meta-item watch-event-detail__meta-item--place">
              <PinIcon />
              <span>
                <strong>{location}</strong>
              </span>
            </div>
            <div className="watch-event-detail__meta-item watch-event-detail__meta-item--going">
              <UsersIcon />
              <span>
                <strong>
                  {event._count.rsvps}
                  {event.capacity ? ` / ${event.capacity}` : ""} going
                </strong>
              </span>
            </div>
          </div>

          <div className="watch-event-detail__venue">
            {event.place?.imageUrl ? (
              <img
                className="watch-event-detail__venue-image"
                src={event.place.imageUrl}
                alt={event.place.name}
              />
            ) : (
              <span className="watch-event-detail__venue-placeholder" aria-hidden="true">
                <PinIcon />
              </span>
            )}
            <div className="watch-event-detail__venue-copy">
              <span className="watch-event-detail__venue-label">Venue</span>
              <strong>{event.place?.name || location}</strong>
              {watchArea ? <small>{watchArea}</small> : null}
            </div>
            <span className="watch-event-detail__authority">{watchAuthority}</span>
          </div>

          <div className="watch-event-detail__actions" aria-label="Watch event actions">
            {!rsvp && eventOpen ? (
              <button
                className="watch-event-detail__action watch-event-detail__action--primary"
                type="button"
                disabled={actionPending || participationLoading}
                onClick={() => void join()}
              >
                <UsersIcon />
                {actionPending ? "Joining…" : "Join event"}
              </button>
            ) : null}
            {event.place ? (
              <Link
                className="watch-event-detail__action watch-event-detail__action--place"
                to={`/places/${event.place.id}?eventId=${encodeURIComponent(event.id)}`}
              >
                <PinIcon />
                View place
              </Link>
            ) : null}
            {canManage ? (
              <a
                className="watch-event-detail__action watch-event-detail__action--edit"
                href={`/events/${event.id}/edit`}
              >
                Edit event
              </a>
            ) : null}
          </div>

          {rsvpLabel ? (
            <div className="watch-event-detail__participation">
              <span className="watch-event-detail__rsvp-state">{rsvpLabel}</span>
              {rsvp === "WAITLISTED" || rsvp === "CONFIRMED" ? (
                <button
                  className="watch-event-detail__cancel"
                  type="button"
                  disabled={actionPending}
                  onClick={() => void leave()}
                >
                  {actionPending
                    ? "Updating…"
                    : rsvp === "WAITLISTED"
                      ? "Leave waitlist"
                      : "Cancel RSVP"}
                </button>
              ) : null}
            </div>
          ) : null}

          {status ? <p className="success">{status}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : (
        <section className="play-event-card play-event-card--matchday">
          <span className="play-event-card__pitch-grid" aria-hidden="true" />
          <div className="play-event-card__kicker-row">
            <div className="play-event-card__kicker">Pickup match</div>
            <span className="play-event-card__ticket-mark">Matchday</span>
          </div>
          <div className="play-event-card__title-row">
            <span
              className="play-event-card__ball"
              style={{
                width: "auto",
                height: "auto",
                border: 0,
                borderRadius: 0,
                background: "transparent",
                boxShadow: "none",
                color: "#fff8e8",
              }}
            >
              <BallIcon />
            </span>
            <div>
              <h1>{event.title}</h1>
              {event.description ? <p>{event.description}</p> : null}
            </div>
          </div>
          <div className="play-event-card__meta" aria-label="Match essentials">
            <span>
              <CalendarIcon color={playYellow} />
              {new Date(event.startsAt).toLocaleString()}
            </span>
            <span>
              <PinIcon color={playYellow} />
              {location}
            </span>
            <span>
              <UsersIcon color={playYellow} />
              {event._count.rsvps}
              {event.capacity ? ` / ${event.capacity}` : ""} going
            </span>
          </div>

          {event.place ? (
            <div className="play-event-card__tagged-pitch">
              <span
                className="play-event-card__tagged-pitch-icon"
                aria-hidden="true"
                style={{
                  width: "auto",
                  height: "auto",
                  borderRadius: 0,
                  background: "transparent",
                  color: playYellow,
                }}
              >
                <PinIcon color={playYellow} />
              </span>
              <div>
                <small>HOOMA Pitch</small>
                <strong>{event.place.name}</strong>
                <span>{[event.place.city, event.place.houma].filter(Boolean).join(" · ")}</span>
              </div>
              <a href={`/pitch/${event.place.id}`}>View Pitch</a>
            </div>
          ) : null}

          <div className="play-event-card__facts" aria-label="Match facts">
            <div>
              <span>Format</span>
              <strong>{pretty(play?.format)}</strong>
            </div>
            <div>
              <span>Pitch</span>
              <strong>{pretty(play?.pitchType)}</strong>
            </div>
            <div>
              <span>Level</span>
              <strong>{pretty(play?.skillLevel)}</strong>
            </div>
            <div>
              <span>Community</span>
              <strong>{event.community?.name || "—"}</strong>
            </div>
          </div>

          {rsvpLabel ? (
            <div
              className="play-event-rsvp-state"
              style={
                rsvp === "CONFIRMED"
                  ? {
                      color: confirmedPistachio,
                      fontSize: "15px",
                    }
                  : undefined
              }
            >
              {rsvp === "CONFIRMED" ? "✓ " : ""}
              {rsvpLabel}
            </div>
          ) : null}
          {rsvp === "ATTENDED" ? (
            <div className="play-event-primary-action play-event-primary-action--static">
              Checked in
            </div>
          ) : rsvp === "WAITLISTED" || rsvp === "CONFIRMED" ? (
            <button
              className="play-event-primary-action"
              type="button"
              disabled={actionPending}
              onClick={() => void leave()}
              style={
                rsvp === "CONFIRMED"
                  ? {
                      borderColor: "rgba(190, 92, 23, 0.45)",
                      background: "rgba(255, 145, 61, 0.11)",
                      color: "#c65a16",
                      fontSize: "14px",
                      boxShadow: "none",
                    }
                  : undefined
              }
            >
              {actionPending
                ? "Updating…"
                : rsvp === "WAITLISTED"
                  ? "Leave waitlist"
                  : "Cancel RSVP"}
            </button>
          ) : eventOpen ? (
            <button
              className="play-event-primary-action"
              type="button"
              disabled={actionPending || participationLoading}
              onClick={() => void join()}
            >
              {actionPending ? "Joining…" : "Join in one tap"}
            </button>
          ) : null}
          {status ? <p className="success">{status}</p> : null}
          {error ? <p className="error">{error}</p> : null}
        </section>
      )}

      <EventWhistleBoard eventId={eventId} />

      {!isWatch ? (
        <section className="play-matchday-hub" aria-labelledby="play-matchday-title">
          <div>
            <p className="eyebrow">Matchday hub</p>
            <h2 id="play-matchday-title">Event actions</h2>
          </div>
          <div className="play-matchday-actions">
            <a href={`/events/${eventId}/formation`}>
              <strong>Formation builder</strong>
              <span>{pretty(play?.format)} · build teams and positions</span>
            </a>
            <a href={`/events/${eventId}/chat`}>
              <strong>Temporary event chat</strong>
              <span>Available only to participants while the event chat window is open</span>
            </a>
            <a href={`/events/${eventId}/check-in`}>
              <strong>Check in</strong>
              <span>Confirmed participants can mark attendance on matchday</span>
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
