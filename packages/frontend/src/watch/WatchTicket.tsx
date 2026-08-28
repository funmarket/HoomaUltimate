import type { PublicEvent } from "../events/api";
import { FitSingleLineText } from "../ui/FitSingleLineText";
import { PinIcon, UsersIcon } from "../ui/HoomaIcons";

export type WatchTicketVariant = "feed" | "place-detail";

type EventDateParts = {
  readonly date: string;
  readonly time: string;
};

function eventDateParts(event: PublicEvent): EventDateParts {
  const startsAt = new Date(event.startsAt);
  const options = { timeZone: event.timezone } as const;
  try {
    const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", ...options }).format(
      startsAt,
    );
    const day = new Intl.DateTimeFormat("en-US", { day: "2-digit", ...options }).format(startsAt);
    const month = new Intl.DateTimeFormat("en-US", { month: "short", ...options })
      .format(startsAt)
      .slice(0, 3)
      .toUpperCase();
    const time = new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      ...options,
    }).format(startsAt);

    return {
      date: `${weekday}, ${month[0]}${month.slice(1).toLowerCase()} ${day}`,
      time,
    };
  } catch {
    const day = String(startsAt.getDate()).padStart(2, "0");
    const month = startsAt
      .toLocaleDateString("en-US", { month: "short" })
      .slice(0, 3)
      .toUpperCase();
    const weekday = startsAt.toLocaleDateString("en-US", { weekday: "short" });
    return {
      date: `${weekday}, ${month[0]}${month.slice(1).toLowerCase()} ${day}`,
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
    event.publisherAuthority === "VERIFIED_PLACE_OWNER"
      ? "PUBLISHED BY VENUE"
      : "COMMUNITY-PUBLISHED";
  const placeHref = `/places/${place.id}?eventId=${encodeURIComponent(event.id)}`;
  const matchup = event.watchDetails?.kind === "MATCH" ? event.watchDetails : null;
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
                  <FitSingleLineText
                    className="watch-ticket__team-name watch-ticket__team-name--one"
                    text={matchup.teamOneName}
                    minFontSize={11}
                    maxFontSize={38}
                  />
                  <small>VS</small>
                  <FitSingleLineText
                    className="watch-ticket__team-name watch-ticket__team-name--two"
                    text={matchup.teamTwoName}
                    minFontSize={11}
                    maxFontSize={38}
                  />
                </span>
                <TeamMark name={matchup.teamTwoName} logoUrl={matchup.teamTwoLogoUrl} />
              </>
            ) : (
              <span className="watch-ticket__matchup-title watch-ticket__matchup-title--legacy">
                <FitSingleLineText
                  className="watch-ticket__team-name"
                  text={event.title}
                  minFontSize={12}
                  maxFontSize={40}
                />
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
              <span className="watch-ticket__detail-copy">
                <FitSingleLineText
                  className="watch-ticket__date-text"
                  text={date}
                  minFontSize={10}
                  maxFontSize={27}
                />
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
          aria-label={`Open ${event.title}, ${date} at ${time}`}
        >
          <img className="watch-ticket__stub-logo" src="/brand/hooma-watch-stub.webp" alt="" />
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
