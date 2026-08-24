import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import type { PlayLookingFor } from "@hooma/contracts/play";
import { PickupMatchCard, PlayHero } from "@hooma/ui";
import { useHoomaFrontend } from "../context";
import type { PublicEvent } from "./api";
import { createPlayApi, type MyPlayPlayerListing, type PublicPlayPlayerListing } from "./play-api";
import { PlayPlayerCard } from "./PlayPlayerCard";
import { useEventApi } from "./useEventApi";

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function PlayPage() {
  const eventApi = useEventApi();
  const { api, transport, authenticationHref, protectedError } = useHoomaFrontend();
  const playApi = useMemo(() => createPlayApi(transport), [transport]);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [listings, setListings] = useState<PublicPlayPlayerListing[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [myListing, setMyListing] = useState<MyPlayPlayerListing | null>(null);
  const [lookingFor, setLookingFor] = useState<PlayLookingFor>("GAME");
  const [eventsLoading, setEventsLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [playersError, setPlayersError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [notice, setNotice] = useState("");

  const loadListings = useCallback(async () => {
    const page = await playApi.publicPlayerListings();
    setListings(page.items);
  }, [playApi]);

  useEffect(() => {
    setEventsLoading(true);
    setEventsError("");
    void eventApi
      .publicPlay()
      .then((page) => setEvents(page.items))
      .catch((reason) => setEventsError(errorMessage(reason, "Matches could not be loaded")))
      .finally(() => setEventsLoading(false));
  }, [eventApi]);

  useEffect(() => {
    setPlayersLoading(true);
    setPlayersError("");
    void loadListings()
      .catch((reason) =>
        setPlayersError(errorMessage(reason, "Player listings could not be loaded")),
      )
      .finally(() => setPlayersLoading(false));
  }, [loadListings]);

  useEffect(() => {
    let active = true;
    setAccountLoading(true);
    void api.identity
      .meOptional()
      .then((response) => {
        if (active) setMe(response);
      })
      .catch((reason) => {
        if (active) setMemberError(errorMessage(reason, "Unable to check your HOOMA account"));
      })
      .finally(() => {
        if (active) setAccountLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (!me) {
      setMyListing(null);
      return;
    }
    let active = true;
    setMemberError("");
    void playApi
      .myPlayerListing()
      .then((listing) => {
        if (!active) return;
        setMyListing(listing);
        if (listing) setLookingFor(listing.lookingFor);
      })
      .catch((reason) => {
        if (active) setMemberError(protectedError(reason, "Unable to load your player listing"));
      });
    return () => {
      active = false;
    };
  }, [me, playApi, protectedError]);

  async function saveListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMemberError("");
    setNotice("");
    try {
      const saved = await playApi.savePlayerListing({ lookingFor });
      setMyListing(saved);
      setLookingFor(saved.lookingFor);
      setNotice(myListing ? "Your availability is updated." : "You are now visible in Players.");
      await loadListings();
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to publish your availability"));
    } finally {
      setSaving(false);
    }
  }

  async function removeListing() {
    setSaving(true);
    setMemberError("");
    setNotice("");
    try {
      await playApi.removePlayerListing();
      setMyListing(null);
      setNotice("Your player listing has been removed.");
      await loadListings();
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to remove your player listing"));
    } finally {
      setSaving(false);
    }
  }

  const signInHref = authenticationHref("/play");

  return (
    <section className="play-page">
      <PlayHero />

      <section className="play-section" aria-labelledby="players-looking-title">
        <div className="play-section-heading">
          <div>
            <p className="eyebrow">Players</p>
            <h2 id="players-looking-title">Looking to play</h2>
          </div>
          {!accountLoading && !me && signInHref ? (
            <a className="play-player-publish" href={signInHref}>
              Publish availability
            </a>
          ) : null}
        </div>

        {memberError ? <div className="play-state panel error">{memberError}</div> : null}
        {notice ? <div className="play-state panel success">{notice}</div> : null}

        {!accountLoading && me ? (
          <form className="play-player-editor panel" onSubmit={saveListing}>
            <div>
              <strong>{myListing ? "Your availability" : "Want to play?"}</strong>
              <span>Publish only when you want other HOOMA users to see that you are looking.</span>
            </div>
            <div className="play-looking-options" role="group" aria-label="Looking for">
              <button
                type="button"
                aria-pressed={lookingFor === "GAME"}
                onClick={() => setLookingFor("GAME")}
              >
                A game
              </button>
              <button
                type="button"
                aria-pressed={lookingFor === "TEAM"}
                onClick={() => setLookingFor("TEAM")}
              >
                A team
              </button>
            </div>
            <div className="play-player-editor-actions">
              <button className="button" type="submit" disabled={saving}>
                {saving ? "Saving…" : myListing ? "Update" : "Publish"}
              </button>
              {myListing ? (
                <button
                  className="button secondary"
                  type="button"
                  disabled={saving}
                  onClick={() => void removeListing()}
                >
                  Remove
                </button>
              ) : null}
            </div>
          </form>
        ) : null}

        {playersLoading ? <div className="play-state panel">Loading players…</div> : null}
        {!playersLoading && playersError ? (
          <div className="play-state panel error">{playersError}</div>
        ) : null}
        {!playersLoading && !playersError && listings.length ? (
          <div className="play-player-list">
            {listings.map((listing) => (
              <PlayPlayerCard listing={listing} key={listing.id} />
            ))}
          </div>
        ) : null}
        {!playersLoading && !playersError && !listings.length ? (
          <div className="play-player-empty panel">
            <strong>No players are looking right now.</strong>
            <span>
              Published availability will appear here without requiring visitors to sign in.
            </span>
          </div>
        ) : null}
      </section>

      <section className="play-section" aria-labelledby="open-matches-title">
        <div className="play-section-heading">
          <div>
            <p className="eyebrow">Open matches</p>
            <h2 id="open-matches-title">Pickup games</h2>
          </div>
        </div>

        {eventsLoading ? <div className="play-state panel">Loading matches…</div> : null}
        {!eventsLoading && eventsError ? (
          <div className="play-state panel error">Matches could not be loaded: {eventsError}</div>
        ) : null}
        {!eventsLoading && !eventsError && events.length ? (
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
                format={event.playDetails?.format ?? null}
                href={`/events/${event.id}`}
              />
            ))}
          </div>
        ) : null}
        {!eventsLoading && !eventsError && !events.length ? (
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
    minute: "2-digit",
  }).format(new Date(value));
}
