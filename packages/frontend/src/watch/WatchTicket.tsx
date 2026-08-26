import { WATCH_COLLECTOR_TICKET_MASTER } from "@hooma/ui";
import type { PublicEvent } from "../events/api";

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

export function WatchTicket({ event }: { readonly event: PublicEvent }) {
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
      <a className="watch-ticket__place-photo" href={placeHref} aria-label={`Open ${place.name}`}>
        {place.imageUrl ? <img src={place.imageUrl} alt={place.name} /> : <span>{place.name}</span>}
      </a>
      <span className="watch-ticket__series">COLLECTOR SERIES</span>
      <a className="watch-ticket__matchup" href={`/events/${event.id}`} title={event.title}>
        {matchup ? (
          <>
            <TeamMark name={matchup.teamOneName} logoUrl={matchup.teamOneLogoUrl} />
            <span className="watch-ticket__matchup-title">
              <strong>{matchup.teamOneName}</strong>
              <small>VS</small>
              <strong>{matchup.teamTwoName}</strong>
            </span>
            <TeamMark name={matchup.teamTwoName} logoUrl={matchup.teamTwoLogoUrl} />
          </>
        ) : (
          <span className="watch-ticket__matchup-title watch-ticket__matchup-title--legacy">
            <strong>{event.title}</strong>
          </span>
        )}
      </a>
      <a className="watch-ticket__venue" href={placeHref} title={place.name}>
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
