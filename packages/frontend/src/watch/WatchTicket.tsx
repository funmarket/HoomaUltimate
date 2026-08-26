import type { PublicEvent } from "../events/api";
import { CalendarIcon, PinIcon, UsersIcon } from "../ui/HoomaIcons";

export type WatchTicketVariant = "feed" | "place-detail";

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

function TeamMark({ name, logoUrl }: { readonly name: string; readonly logoUrl: string | null }) {
  return (
    <span className="watch-ticket__team-mark">
      {logoUrl ? (
        <img className="watch-ticket__team-logo" src={logoUrl} alt={`${name} logo`} />
      ) : (
        <span className="watch-ticket__team-placeholder" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export function WatchTicket({
  event,
  variant = "feed",
}: {
  readonly event: PublicEvent;
  readonly variant?: WatchTicketVariant;
}) {
  const { date, time } = eventDateParts(event);
  const place = event.place;
  if (!place) return null;

  const location =
    [place.city, place.houma ? `Houma: ${place.houma}` : null].filter(Boolean).join(", ") ||
    place.address;
  const status =
    event.venueAuthority === "OFFICIAL_VENUE" ? "OFFICIAL VENUE" : "SUGGESTED BY COMMUNITY";
  const placeHref = `/places/${place.id}?eventId=${encodeURIComponent(event.id)}`;
  const matchup = event.watchDetails;
  const feedVariant = variant === "feed";

  return (
    <article
      className={`watch-ticket watch-ticket--${variant}`}
      aria-label={`${event.title}, ${place.name}, ${date} at ${time}`}
    >
      <section className="watch-ticket__upper">
        <div className="watch-ticket__paper">
          <header className="watch-ticket__series" aria-label="Collector Series">
            <span aria-hidden="true">★ ★</span>
            <strong>COLLECTOR SERIES</strong>
            <span aria-hidden="true">★ ★</span>
          </header>

          <a className="watch-ticket__matchup" href={`/events/${event.id}`} title={event.title}>
            {matchup ? (
              <>
                <TeamMark name={matchup.teamOneName} logoUrl={matchup.teamOneLogoUrl} />
                <span className="watch-ticket__matchup-title">
                  <strong className="watch-ticket__team-name watch-ticket__team-name--one">
                    {matchup.teamOneName}
                  </strong>
                  <small>VS</small>
                  <strong className="watch-ticket__team-name watch-ticket__team-name--two">
                    {matchup.teamTwoName}
                  </strong>
                </span>
                <TeamMark name={matchup.teamTwoName} logoUrl={matchup.teamTwoLogoUrl} />
              </>
            ) : (
              <span className="watch-ticket__matchup-title watch-ticket__matchup-title--legacy">
                <strong>{event.title}</strong>
              </span>
            )}
          </a>

          <div className="watch-ticket__divider" aria-hidden="true" />

          <div className="watch-ticket__details">
            <a
              className="watch-ticket__detail watch-ticket__venue"
              href={placeHref}
              title={place.name}
            >
              <PinIcon className="watch-ticket__detail-icon" />
              <span className="watch-ticket__detail-copy">
                <strong>{place.name}</strong>
                <span>{location}</span>
              </span>
            </a>

            <div className="watch-ticket__detail watch-ticket__date">
              <CalendarIcon className="watch-ticket__detail-icon" />
              <span className="watch-ticket__detail-copy">
                <strong>{date}</strong>
                <span>{time}</span>
              </span>
            </div>

            <div className="watch-ticket__detail watch-ticket__attendance">
              <UsersIcon className="watch-ticket__detail-icon" />
              <span className="watch-ticket__detail-copy">
                <strong>
                  {event._count.rsvps} <small>going</small>
                </strong>
                <span className="watch-ticket__status">{status}</span>
              </span>
            </div>
          </div>
        </div>

        <a
          className="watch-ticket__stub"
          href={`/events/${event.id}`}
          aria-label={`Open ${event.title}`}
        >
          <span className="watch-ticket__stub-ball" aria-hidden="true">
            ⚽
          </span>
          <strong>HOOMA</strong>
        </a>
      </section>

      {feedVariant ? (
        <a className="watch-ticket__photo-panel" href={placeHref} aria-label={`Open ${place.name}`}>
          {place.imageUrl ? (
            <img src={place.imageUrl} alt={place.name} />
          ) : (
            <span>{place.name}</span>
          )}
        </a>
      ) : null}
    </article>
  );
}
