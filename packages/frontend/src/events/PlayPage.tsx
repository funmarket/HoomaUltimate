import { useEffect, useState } from "react";
import { PickupMatchCard, PlayHero } from "@hooma/ui";
import type { PublicEvent } from "./api";
import { useEventApi } from "./useEventApi";

export function PlayPage() {
  const eventApi = useEventApi();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    void eventApi.publicPlay()
      .then((page) => setEvents(page.items))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, [eventApi]);

  return (
    <section className="play-page">
      <PlayHero />

      <section className="play-section" aria-labelledby="players-looking-title">
        <div className="play-section-heading">
          <div>
            <p className="eyebrow">Players</p>
            <h2 id="players-looking-title">Looking to play</h2>
          </div>
        </div>
        <div className="play-player-empty panel">
          <strong>Player listings will appear here.</strong>
          <span>Only real player listings and explicitly published contact details will render in this feed.</span>
        </div>
      </section>

      <section className="play-section" aria-labelledby="open-matches-title">
        <div className="play-section-heading">
          <div>
            <p className="eyebrow">Open matches</p>
            <h2 id="open-matches-title">Pickup games</h2>
          </div>
        </div>

        {loading ? <div className="play-state panel">Loading matches…</div> : null}
        {!loading && error ? <div className="play-state panel error">Matches could not be loaded: {error}</div> : null}
        {!loading && !error && events.length ? (
          <div className="play-match-list">
            {events.map((event) => (
              <PickupMatchCard
                key={event.id}
                title={event.title}
                dateLabel={formatDate(event.startsAt)}
                venueName={event.venueName || event.address}
                communityName={event.community.name}
                goingCount={event._count.rsvps}
                capacity={event.capacity}
                format={event.playDetails?.format}
                href={`/events/${event.id}`}
              />
            ))}
          </div>
        ) : null}
        {!loading && !error && !events.length ? (
          <div className="play-state panel">
            <strong>No open matches yet.</strong>
            <span>Create the first pickup match for your HOOMA community.</span>
          </div>
        ) : null}
      </section>
    </section>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}
