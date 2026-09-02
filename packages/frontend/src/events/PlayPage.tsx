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

type PlayView = "games" | "players" | "mine";

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
  const [activeView, setActiveView] = useState<PlayView>("games");
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [eventsNextCursor, setEventsNextCursor] = useState<string | null>(null);
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

  const loadManagedEvents = useCallback(async () => {
    setManagedEvents(await playApi.managedEvents());
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
      setEventsNextCursor(null);
      setEventsError("");
      setEventsLoading(false);
      return;
    }
    let active = true;
    setEventsLoading(true);
    setEventsError("");
    void playApi
      .openMatches({ limit: 50 })
      .then((page) => {
        if (!active) return;
        setEvents(page.items);
        setEventsNextCursor(page.nextCursor);
      })
      .catch((reason) => {
        if (active) setEventsError(protectedError(reason, "Matches could not be loaded"));
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
      setManagedEvents([]);
      return;
    }
    let active = true;
    setMemberError("");
    void Promise.all([playApi.myPlayerListing(), playApi.actionState(), playApi.managedEvents()])
      .then(([listing, currentActions, mineEvents]) => {
        if (!active) return;
        setMyListing(listing);
        setActionState(currentActions);
        setManagedEvents(mineEvents);
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

  async function loadMoreMatches() {
    if (!eventsNextCursor || eventsLoading) return;
    setEventsLoading(true);
    setEventsError("");
    try {
      const page = await playApi.openMatches({ limit: 50, cursor: eventsNextCursor });
      setEvents((current) => [...current, ...page.items]);
      setEventsNextCursor(page.nextCursor);
    } catch (reason) {
      setEventsError(protectedError(reason, "Matches could not be loaded"));
    } finally {
      setEventsLoading(false);
    }
  }

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
      setInviteEventId("");
      await loadManagedEvents().catch(() => undefined);
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

      <div className="play-view-tabs play-view-tabs--three" role="tablist" aria-label="Play sections">
        <button className={`play-view-tab${activeView === "games" ? " is-active" : ""}`} type="button" role="tab" aria-selected={activeView === "games"} onClick={() => setActiveView("games")}>
          Games
        </button>
        <button className={`play-view-tab${activeView === "players" ? " is-active" : ""}`} type="button" role="tab" aria-selected={activeView === "players"} onClick={() => setActiveView("players")}>
          Players
        </button>
        <button className={`play-view-tab${activeView === "mine" ? " is-active" : ""}`} type="button" role="tab" aria-selected={activeView === "mine"} onClick={() => setActiveView("mine")}>
          Mine
        </button>
      </div>

      {memberError ? <div className="play-state panel error">{memberError}</div> : null}
      {notice ? <div className="play-state panel success">{notice}</div> : null}

      {activeView === "games" ? (
        <section className="play-section" aria-labelledby="open-matches-title">
          <div className="play-section-heading">
            <div>
              <p className="eyebrow">Games</p>
              <h2 id="open-matches-title">Pickup games</h2>
            </div>
          </div>
          {!accountLoading && !me ? (
            <div className="play-state panel">
              <strong>Sign in to see games.</strong>
              <span>Open matches are available to HOOMA accounts.</span>
              {signInHref ? <a className="play-action play-action--commit" href={signInHref}>Sign in</a> : null}
            </div>
          ) : null}
          {eventsLoading ? <div className="play-state panel">Loading matches…</div> : null}
          {!eventsLoading && eventsError ? (
            <div className="play-state panel error">Matches could not be loaded: {eventsError}</div>
          ) : null}
          {!eventsError && me && events.length ? (
            <>
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
              {eventsNextCursor ? (
                <button className="play-action play-action--secondary play-load-more" type="button" onClick={() => void loadMoreMatches()} disabled={eventsLoading}>
                  {eventsLoading ? "Loading…" : "Load more matches"}
                </button>
              ) : null}
            </>
          ) : null}
          {!eventsLoading && !eventsError && me && !events.length ? (
            <div className="play-state panel">
              <strong>No open matches yet.</strong>
              <span>Create the first pickup match for your HOOMA community.</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeView === "players" ? (
        <section className="play-section" aria-labelledby="players-looking-title">
          {!accountLoading && !me && signInHref ? (
            <a className="play-player-publish" href={signInHref}>Sign in to publish</a>
          ) : null}
          {!accountLoading && me ? (
            <form className="play-player-editor panel" onSubmit={saveListing}>
              <div>
                <strong>{myListing ? "Your availability" : "Want to play?"}</strong>
                <span>Publish only when you want other HOOMA users to see that you are looking.</span>
              </div>
              <div className="play-looking-options" role="group" aria-label="Looking for">
                <button type="button" aria-pressed={lookingFor === "GAME"} onClick={() => setLookingFor("GAME")}>A game</button>
                <button type="button" aria-pressed={lookingFor === "TEAM"} onClick={() => setLookingFor("TEAM")}>A team</button>
              </div>
              <div className="play-player-editor-actions">
                <button className="play-action play-action--commit" type="submit" disabled={saving}>
                  {saving ? "Saving…" : myListing ? "Update" : "Publish"}
                </button>
                {myListing ? (
                  <button className="play-action play-action--danger" type="button" disabled={saving} onClick={() => void removeListing()}>
                    Remove
                  </button>
                ) : null}
              </div>
            </form>
          ) : null}
          {offerListing ? (
            <form ref={offerFormRef} className="play-sheet panel" onSubmit={sendOffer} tabIndex={-1}>
              <div className="play-sheet__person">
                <div className="play-sheet__avatar" aria-hidden="true">
                  {offerListing.presentation?.photoUrl ? <img src={offerListing.presentation.photoUrl} alt="" /> : <span>{(offerListing.presentation?.displayName ?? "P").slice(0, 1)}</span>}
                </div>
                <div>
                  <strong>{offerListing.presentation?.displayName ?? "Player"}</strong>
                  <small>{offerListing.presentation?.username ? `@${offerListing.presentation.username}` : "Looking for a team"}</small>
                </div>
              </div>
              <div>
                <h3>Offer a spot</h3>
                <p>Choose a team you manage.</p>
              </div>
              <div className="play-sheet__choices" role="listbox" aria-label="Teams">
                {recruitingTeams.map((team) => (
                  <button key={team.id} type="button" role="option" aria-selected={offerTeamId === team.id} className={`play-sheet__choice${offerTeamId === team.id ? " is-selected" : ""}`} disabled={offerLoading} onClick={() => setOfferTeamId(team.id)}>
                    <strong>{team.name}</strong>
                    <span>Offer a roster spot</span>
                  </button>
                ))}
              </div>
              <label>
                Message (optional)
                <textarea value={offerMessage} onChange={(event) => setOfferMessage(event.target.value)} maxLength={240} rows={3} placeholder="Come train with us this week." disabled={offerLoading} />
              </label>
              {selectedOfferPending ? <p>This team already has a pending offer for this player.</p> : null}
              <button className="play-action play-action--commit play-action--block" type="submit" disabled={offerLoading || !offerTeamId || selectedOfferPending}>
                {offerLoading ? "Sending…" : selectedOfferPending ? "Offer pending" : "Send offer"}
              </button>
              <button className="play-action play-action--quiet" type="button" disabled={offerLoading} onClick={() => setOfferListing(null)}>Cancel</button>
            </form>
          ) : null}
          {inviteListing ? (
            <form ref={inviteFormRef} className="play-sheet panel" onSubmit={sendInvite} tabIndex={-1}>
              <div className="play-sheet__person">
                <div className="play-sheet__avatar" aria-hidden="true">
                  {inviteListing.presentation?.photoUrl ? <img src={inviteListing.presentation.photoUrl} alt="" /> : <span>{(inviteListing.presentation?.displayName ?? "P").slice(0, 1)}</span>}
                </div>
                <div>
                  <strong>{inviteListing.presentation?.displayName ?? "Player"}</strong>
                  <small>{inviteListing.presentation?.username ? `@${inviteListing.presentation.username}` : "Looking for a game"}</small>
                </div>
              </div>
              <div>
                <h3>Invite {inviteListing.presentation?.displayName ?? "this player"} to a game</h3>
                <p>Choose a match and send an invite.</p>
              </div>
              <div className="play-sheet__choices" role="listbox" aria-label="Games">
                {managedEvents.map((managedEvent) => (
                  <button key={managedEvent.id} type="button" role="option" aria-selected={inviteEventId === managedEvent.id} className={`play-sheet__choice${inviteEventId === managedEvent.id ? " is-selected" : ""}`} disabled={inviteLoading} onClick={() => setInviteEventId(managedEvent.id)}>
                    <strong>{managedEvent.title}</strong>
                    <span>{formatDate(managedEvent.startsAt)}</span>
                  </button>
                ))}
              </div>
              {selectedInvitePending ? <p>This game already has a pending invite for this player.</p> : null}
              <button className="play-action play-action--commit play-action--block" type="submit" disabled={inviteLoading || !inviteEventId || selectedInvitePending}>
                {inviteLoading ? "Sending…" : selectedInvitePending ? "Invite pending" : "Send invite"}
              </button>
              <button className="play-action play-action--quiet" type="button" disabled={inviteLoading} onClick={() => setInviteListing(null)}>Cancel</button>
            </form>
          ) : null}
          <h2 id="players-looking-title" className="play-list-title">Looking to play</h2>
          {playersLoading ? <div className="play-state panel">Loading players…</div> : null}
          {!playersLoading && playersError ? <div className="play-state panel error">{playersError}</div> : null}
          {!playersLoading && !playersError && listings.length ? (
            <div className="play-player-list">
              {listings.map((listing) => (
                <PlayPlayerCard listing={listing} key={listing.id} onInvite={(candidate) => void startInvite(candidate)} onHire={(candidate) => void startHire(candidate)} actionDisabled={actionBusy} />
              ))}
            </div>
          ) : null}
          {!playersLoading && !playersError && !listings.length ? (
            <div className="play-player-empty panel">
              <strong>No players are looking right now.</strong>
              <span>Published availability will appear here without requiring visitors to sign in.</span>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeView === "mine" ? (
        <section className="play-section play-mine" aria-labelledby="mine-title">
          <div className="play-section-heading">
            <div>
              <p className="eyebrow">Mine</p>
              <h2 id="mine-title">Your board</h2>
            </div>
          </div>
          {!accountLoading && !me ? (
            <div className="play-state panel">
              <strong>Sign in to see your games.</strong>
              {signInHref ? <a className="play-action play-action--commit" href={signInHref}>Sign in</a> : null}
            </div>
          ) : null}
          {me ? (
            <>
              <div className="play-mine-listing panel">
                {myListing ? (
                  <>
                    <span className="play-looking-badge"><i aria-hidden="true" /> Live · Looking for {lookingFor === "GAME" ? "a game" : "a team"}</span>
                    <strong>Your listing is visible on Players</strong>
                    <div className="play-player-editor-actions">
                      <button className="play-action play-action--secondary" type="button" onClick={() => setActiveView("players")}>Update</button>
                      <button className="play-action play-action--danger" type="button" disabled={saving} onClick={() => void removeListing()}>Remove</button>
                    </div>
                  </>
                ) : (
                  <>
                    <strong>You are not listed right now</strong>
                    <span>Publish availability when you want a game or a team.</span>
                    <button className="play-action play-action--primary" type="button" onClick={() => setActiveView("players")}>Publish that you want a game</button>
                  </>
                )}
              </div>
              <h3 className="play-mine-heading">Your games</h3>
              {managedEvents.length ? (
                <div className="play-mine-games">
                  {managedEvents.map((managedEvent) => (
                    <a className="play-mine-game" href={`/events/${managedEvent.id}`} key={managedEvent.id}>
                      <strong>{managedEvent.title}</strong>
                      <span>{formatDate(managedEvent.startsAt)} · Organizer</span>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="play-mine-empty">Games you organize will show up here.</p>
              )}
              <h3 className="play-mine-heading">Waiting on you</h3>
              <EventInvitesPanel />
              <TeamOffersPanel />
            </>
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
