import type { PublicEvent } from "../events/api";
import { PinIcon, UsersIcon } from "../ui/HoomaIcons";
import "./cultural.css";

function eventDate(event: PublicEvent): { date: string; time: string } {
  const startsAt = new Date(event.startsAt);
  const options = { timeZone: event.timezone } as const;
  try {
    return {
      date: new Intl.DateTimeFormat(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        ...options,
      }).format(startsAt),
      time: new Intl.DateTimeFormat(undefined, {
        hour: "2-digit",
        minute: "2-digit",
        ...options,
      }).format(startsAt),
    };
  } catch {
    return {
      date: startsAt.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
      time: startsAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }),
    };
  }
}

function categoryLabel(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

export function CulturalEventCard({ event }: { readonly event: PublicEvent }) {
  const details = event.watchDetails?.kind === "CULTURAL" ? event.watchDetails : null;
  const place = event.place;
  if (!details || !place) return null;
  const { date, time } = eventDate(event);
  const imageUrl = details.imageUrl ?? place.imageUrl;
  const location = [place.houma, place.city].filter(Boolean).join(" · ") || place.address;

  return (
    <article className="watch-cultural-card">
      <a className="watch-cultural-card__media" href={`/events/${event.id}`}>
        {imageUrl ? <img src={imageUrl} alt="" /> : <span>{categoryLabel(details.culturalCategory)}</span>}
        <span className="watch-cultural-card__category">{categoryLabel(details.culturalCategory)}</span>
      </a>
      <div className="watch-cultural-card__body">
        <div className="watch-cultural-card__time">
          <strong>{date}</strong>
          <span>{time}</span>
        </div>
        <a className="watch-cultural-card__title" href={`/events/${event.id}`}>
          {event.title}
        </a>
        {event.description ? <p>{event.description}</p> : null}
        <div className="watch-cultural-card__meta">
          <a href={`/places/${place.id}?eventId=${encodeURIComponent(event.id)}`}>
            <PinIcon />
            <span>
              <strong>{place.name}</strong>
              <small>{location}</small>
            </span>
          </a>
          <span>
            <UsersIcon /> {event._count.rsvps} going
          </span>
        </div>
      </div>
    </article>
  );
}
