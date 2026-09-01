import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import type { PlayLookingFor } from "@hooma/contracts/play";
import { PickupMatchCard, PlayHero } from "@hooma/ui";
import { useHoomaFrontend } from "../context";
import { TeamOffersPanel } from "../teams/TeamOffersPanel";
import { createTeamOfferApi, type RecruitingTeam } from "../teams/team-offer-api";
import type { PublicEvent } from "./api";
import { EventInvitesPanel } from "./EventInvitesPanel";
import {
  createPlayApi,
  type ManagedPlayEvent,
  type MyPlayPlayerListing,
  type PlayActionState,
  type PublicPlayPlayerListing,
} from "./play-api";
import { PlayPlayerCard } from "./PlayPlayerCard";

type PlayView = "players" | "open-matches";

const emptyActionState: PlayActionState = { teamOffers: [], eventInvites: [] };

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function PlayPage() {
  const { api, transport, authenticationHref, protectedError } = useHoomaFrontend();
  const playApi = useMemo(() => createPlayApi(transport), [transport]);
  const teamOfferApi = useMemo(() => createTeamOfferApi(transport), [transport]);
  const offerFormRef = useRef<HTMLFormElement>(null);
  const inviteFormRef = useRef<HTMLFormElement>(null);
  const [activeView, setActiveView] = useState<PlayView>("players");
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [listings, setListings] = useState<PublicPlayPlayerListing[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [myListing, setMyListing] = useState<MyPlayPlayerListing | null>(null);
  const [lookingFor, setLookingFor] = useState<PlayLookingFor>("GAME");
  const [actionState, setActionState] = useState<PlayActionState>(emptyActionState);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [playersError, setPlayersError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [notice, setNotice] = useState("");
  const [offerListing, setOfferListing] = useState<PublicPlayPlayerListing | null>(null);
  const [recruitingTeams, setRecruitingTeams] = useState<RecruitingTeam[]>([]);
  const [offerTeamId, setOfferTeamId] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [offerLoading, setOfferLoading] = useState(false);
  const [inviteListing, setInviteListing] = useState<PublicPlayPlayerListing | null>(null);
  const [managedEvents, setManagedEvents] = useState<ManagedPlayEvent[]>([]);
  const [inviteEventId, setInviteEventId] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const loadListings = useCallback(async () => {
    const page = await playApi.publicPlayerListings();
    setListings(page.items);
  }, [playApi]);

  const loadActionState = useCallback(async () => {
    setActionState(await playApi.actionState());
  }, [playApi]);

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
    if (accountLoading) return;
    if (!me) {
      setEvents([]);
      setEventsError("");
      setEventsLoading(false);
      return;
    }
    let active = true;
    setEventsLoading(true);
    setEventsError("");
    void playApi
      .openMatches()
      .then((page) => {
        if (active) setEvents(page.items);
      })
      .catch((reason) => {
        if (active)
          setEventsError(protectedError(reason, "Matches could not be loaded"));
      })
      .finally(() => {
        if (active) setEventsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accountLoading, me, playApi, protectedError]);

  useEffect(() => {
    if (!me) {
      setMyListing(null);
      setActionState(emptyActionState);
      return;
    }
    let active = true;
    setMemberError("");
    void Promise.all([playApi.myPlayerListing(), playApi.actionState()])
      .then(([listing, currentActions]) => {
        if (!active) return;
        setMyListing(listing);
        setActionState(currentActions);
        if (listing) setLookingFor(listing.lookingFor);
      })
      .catch((reason) => {
        if (active)
          setMemberError(protectedError(reason, "Unable to load your Play account state"));
      });
    return () => {
      active = false;
    };
  }, [me, playApi, protectedError]);

  useEffect(() => {
    if (!offerListing) return;
    offerFormRef.current?.scrollIntoView({ block: "nearest" });
    offerFormRef.current?.focus({ preventScroll: true });
  }, [offerListing]);

  useEffect(() => {
    if (!inviteListing) return;
    inviteFormRef.current?.scrollIntoView({ block: "nearest" });
    inviteFormRef.current?.focus({ preventScroll: true });
  }, [inviteListing]);

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

  async function startHire(listing: PublicPlayPlayerListing) {
    if (accountLoading || offerLoading || inviteLoading) return;
    if (!me) {
      const href = authenticationHref("/play");
      if (href) window.location.href = href;
      return;
    }
    setMemberError("");
    setNotice("");
    setOfferLoading(true);
    setInviteListing(null);
    try {
      const teams = await teamOfferApi.recruitingTeams();
      if (!teams.length) {
        setMemberError("You need a Team where you can manage the roster before sending an offer.");
        return;
      }
      setRecruitingTeams(teams);
      setOfferTeamId(teams[0]?.id ?? "");
      setOfferMessage("");
      setOfferListing(listing);
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to prepare Team offer"));
    } finally {
      setOfferLoading(false);
    }
  }

  async function startInvite(listing: PublicPlayPlayerListing) {
    if (accountLoading || offerLoading || inviteLoading) return;
    if (!me) {
      const href = authenticationHref("/play");
      if (href) window.location.href = href;
      return;
    }
    setMemberError("");
    setNotice("");
    setInviteLoading(true);
    setOfferListing(null);
    try {
      const availableEvents = await playApi.managedEvents();
      if (!availableEvents.length) {
        setMemberError("You need an active Play event you can manage before inviting a player.");
        return;
      }
      setManagedEvents(availableEvents);
      setInviteEventId(availableEvents[0]?.id ?? "");
      setInviteListing(listing);
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to prepare game invitation"));
    } finally {
      setInviteLoading(false);
    }
  }

  async function sendOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offerListing || !offerTeamId || offerLoading) return;
    const alreadyPending = actionState.teamOffers.some(
      (offer) => offer.listingId === offerListing.id && offer.teamId === offerTeamId,
    );
    if (alreadyPending) return;
    setOfferLoading(true);
    setMemberError("");
    setNotice("");
    try {
      await playApi.sendTeamOffer(offerListing.id, {
        teamId: offerTeamId,
        message: offerMessage.trim() || null,
      });
      await loadActionState();
      setNotice(`Team offer sent to ${offerListing.presentation?.displayName ?? "player"}.`);
      setOfferListing(null);
      setRecruitingTeams([]);
      setOfferTeamId("");
      setOfferMessage("");
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to send Team offer"));
    } finally {
      setOfferLoading(false);
    }
  }

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteListing || !inviteEventId || inviteLoading) return;
    const alreadyPending = actionState.eventInvites.some(
      (invite) => invite.listingId === inviteListing.id && invite.eventId === inviteEventId,
    );
    if (alreadyPending) return;
    setInviteLoading(true);
    setMemberError("");
    setNotice("");
    try {
      await playApi.sendEventInvite(inviteListing.id, { eventId: inviteEventId });
      await loadActionState();
      setNotice(`Game invitation sent to ${inviteListing.presentation?.displayName ?? "player"}.`);
      setInviteListing(null);
      setManagedEvents([]);
      setInviteEventId("");
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to send game invitation"));
    } finally {
      setInviteLoading(false);
    }
  }

  const signInHref = authenticationHref("/play");
  const selectedOfferPending = Boolean(
    offerListing &&
    offerTeamId &&
    actionState.teamOffers.some(
      (offer) => offer.listingId === offerListing.id && offer.teamId === offerTeamId,
    ),
  );
  const selectedInvitePending = Boolean(
    inviteListing &&
    inviteEventId &&
    actionState.eventInvites.some(
      (invite) => invite.listingId === inviteListing.id && invite.eventId === inviteEventId,
    ),
  );
  const actionBusy = accountLoading || offerLoading || inviteLoading;

  return (
    <section className="play-page">
      <PlayHero />

      <div className="play-view-tabs" role="tablist" aria-label="Play sections">
        <button
          className={`play-view-tab${activeView === "players" ? " is-active" : ""}`}
          type="button"
          role="tab"
          aria-selected={activeView === "players"}
          onClick={() => setActiveView("players")}
        >
          Players
        </button>
        <button
          className={`play-view-tab${activeView === "open-matches" ? " is-active" : ""}`}
          type="button"
          role="tab"
          aria-selected={activeView === "open-matches"}
          onClick={() => setActiveView("open-matches")}
        >
          Open matches
        </button>
      </div>

      {activeView === "players" ? (
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
            <>
              <EventInvitesPanel />
              <TeamOffersPanel />
              <form className="play-player-editor panel" onSubmit={saveListing}>
                <div>
                  <strong>{myListing ? "Your availability" : "Want to play?"}</strong>
                  <span>
                    Publish only when you want other HOOMA users to see that you are looking.
                  </span>
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
            </>
          ) : null}

          {offerListing ? (
            <form
              ref={offerFormRef}
              className="play-team-offer panel"
              onSubmit={sendOffer}
              tabIndex={-1}
            >
              <div>
                <p className="eyebrow">TEAM OFFER</p>
                <h3>Offer {offerListing.presentation?.displayName ?? "this player"} a spot</h3>
                <p>Pick your Team and add a short message if you want.</p>
              </div>
              <label>
                Team
                <select
                  value={offerTeamId}
                  onChange={(event) => setOfferTeamId(event.target.value)}
                  disabled={offerLoading}
                >
                  {recruitingTeams.map((team) => (
                    <option value={team.id} key={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Message (optional)
                <textarea
                  value={offerMessage}
                  onChange={(event) => setOfferMessage(event.target.value)}
                  maxLength={240}
                  rows={3}
                  placeholder="Come train with us this week."
                  disabled={offerLoading}
                />
              </label>
              {selectedOfferPending ? (
                <p>This Team already has a pending offer for this player.</p>
              ) : null}
              <div className="play-player-editor-actions">
                <button
                  className="button"
                  type="submit"
                  disabled={offerLoading || !offerTeamId || selectedOfferPending}
                >
                  {offerLoading
                    ? "Sending…"
                    : selectedOfferPending
                      ? "Offer Pending"
                      : "Send Offer"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={offerLoading}
                  onClick={() => setOfferListing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {inviteListing ? (
            <form
              ref={inviteFormRef}
              className="play-team-offer panel"
              onSubmit={sendInvite}
              tabIndex={-1}
            >
              <div>
                <p className="eyebrow">GAME INVITATION</p>
                <h3>Invite {inviteListing.presentation?.displayName ?? "this player"}</h3>
                <p>Choose an active Play event that you can manage.</p>
              </div>
              <label>
                Game
                <select
                  value={inviteEventId}
                  onChange={(event) => setInviteEventId(event.target.value)}
                  disabled={inviteLoading}
                >
                  {managedEvents.map((managedEvent) => (
                    <option value={managedEvent.id} key={managedEvent.id}>
                      {managedEvent.title} · {formatDate(managedEvent.startsAt)}
                    </option>
                  ))}
                </select>
              </label>
              {selectedInvitePending ? (
                <p>This game already has a pending invite for this player.</p>
              ) : null}
              <div className="play-player-editor-actions">
                <button
                  className="button"
                  type="submit"
                  disabled={inviteLoading || !inviteEventId || selectedInvitePending}
                >
                  {inviteLoading
                    ? "Sending…"
                    : selectedInvitePending
                      ? "Invite Pending"
                      : "Send Invite"}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={inviteLoading}
                  onClick={() => setInviteListing(null)}
                >
                  Cancel
                </button>
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
                <PlayPlayerCard
                  listing={listing}
                  key={listing.id}
                  onInvite={(candidate) => void startInvite(candidate)}
                  onHire={(candidate) => void startHire(candidate)}
                  actionDisabled={actionBusy}
                />
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
      ) : null}

      {activeView === "open-matches" ? (
        <section className="play-section" aria-labelledby="open-matches-title">
          <div className="play-section-heading">
            <div>
              <p className="eyebrow">Open matches</p>
              <h2 id="open-matches-title">Pickup games</h2>
            </div>
          </div>

          {!accountLoading && !me ? (
            <div className="play-state panel">
              <strong>Sign in to see Open Matches.</strong>
              <span>Open Matches are available to HOOMA accounts.</span>
              {signInHref ? (
                <a className="button" href={signInHref}>
                  Sign in
                </a>
              ) : null}
            </div>
          ) : null}
          {eventsLoading ? <div className="play-state panel">Loading matches…</div> : null}
          {!eventsLoading && eventsError ? (
            <div className="play-state panel error">Matches could not be loaded: {eventsError}</div>
          ) : null}
          {!eventsLoading && !eventsError && me && events.length ? (
            <div className="play-match-list">
              {events.map((event) => (
                <PickupMatchCard
                  key={event.id}
                  title={event.title}
                  dateLabel={formatDate(event.startsAt)}
                  venueName={event.place?.name || event.venueName || event.address}
                  communityName={event.community?.name ?? "HOOMA match"}
                  goingCount={event._count.rsvps}
                  capacity={event.capacity}
                  format={event.playDetails?.format ?? null}
                  href={`/events/${event.id}`}
                />
              ))}
            </div>
          ) : null}
          {!eventsLoading && !eventsError && me && !events.length ? (
            <div className="play-state panel">
              <strong>No open matches yet.</strong>
              <span>Create the first pickup match for your HOOMA community.</span>
            </div>
          ) : null}
        </section>
      ) : null}
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
