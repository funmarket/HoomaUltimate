import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import type {
  GamerArenaMatch,
  GamerDiscoveryItem,
  GamerGame,
} from "@hooma/contracts/gamers";
import type { ProfileResponse } from "@hooma/contracts/profile";
import { useHoomaFrontend } from "../context";
import { createGamersApi } from "./api";
import { GamerChallengeSetupModal } from "./GamerChallengeSetupModal";
import { GamerHudCard } from "./GamerHudCard";
import { GamerMatchCard } from "./GamerMatchCard";
import { createGamerOnboardingApi } from "./onboarding";

type GamersHomeTab = "GAMERS" | "CHALLENGERS" | "ARENA" | "CATALOG";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected Gamers error";
}

function initialChallengeIntent(): { profileId: string; gameSlug: string } | null {
  const url = new URL(window.location.href);
  const profileId = url.searchParams.get("challenge");
  const gameSlug = url.searchParams.get("game");
  return profileId && gameSlug ? { profileId, gameSlug } : null;
}

export function GamersPage() {
  const { api, transport, protectedError, authenticationHref } = useHoomaFrontend();
  const gamersApi = useMemo(() => createGamersApi(transport), [transport]);
  const onboardingApi = useMemo(() => createGamerOnboardingApi(transport), [transport]);
  const [games, setGames] = useState<GamerGame[]>([]);
  const [gamers, setGamers] = useState<GamerDiscoveryItem[]>([]);
  const [arenaMatches, setArenaMatches] = useState<GamerArenaMatch[]>([]);
  const [arenaNextCursor, setArenaNextCursor] = useState<string | null>(null);
  const [arenaLoadingMore, setArenaLoadingMore] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [identityProfile, setIdentityProfile] = useState<ProfileResponse | null>(null);
  const [activeTab, setActiveTab] = useState<GamersHomeTab>("GAMERS");
  const [challengeTarget, setChallengeTarget] = useState<GamerDiscoveryItem | null>(null);
  const [whistleProfileId, setWhistleProfileId] = useState<string | null>(null);
  const [challengeIntent, setChallengeIntent] = useState(initialChallengeIntent);
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [notice, setNotice] = useState("");

  const isGamer = identityProfile?.identities.includes("GAMER") ?? false;
  const accountHref = authenticationHref("/gamers");
  const challengers = useMemo(() => gamers.filter((gamer) => gamer.openToChallenge), [gamers]);

  const loadPublic = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [gameResponse, discoveryResponse, arenaResponse] = await Promise.all([
        gamersApi.games(),
        gamersApi.discovery(),
        gamersApi.arena(),
      ]);
      setGames(gameResponse.items);
      setGamers(discoveryResponse.items);
      setArenaMatches(arenaResponse.items);
      setArenaNextCursor(arenaResponse.nextCursor);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [gamersApi]);

  useEffect(() => {
    void loadPublic();
  }, [loadPublic]);

  useEffect(() => {
    let active = true;
    setAccountLoading(true);
    setMemberError("");
    void api.identity
      .meOptional()
      .then(async (response) => {
        if (!active) return;
        setMe(response);
        if (!response) {
          setIdentityProfile(null);
          return;
        }
        const profile = await onboardingApi.profile();
        if (active) setIdentityProfile(profile);
      })
      .catch((reason) => {
        if (active) setMemberError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setAccountLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, onboardingApi]);

  useEffect(() => {
    if (!challengeIntent || !gamers.length) return;
    const target = gamers.find(
      (gamer) =>
        gamer.id === challengeIntent.profileId && gamer.game.slug === challengeIntent.gameSlug,
    );
    setChallengeIntent(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("challenge");
    url.searchParams.delete("game");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (target?.openToChallenge) setChallengeTarget(target);
  }, [challengeIntent, gamers]);

  async function joinGamers() {
    setJoining(true);
    setMemberError("");
    setNotice("");
    try {
      setIdentityProfile(await onboardingApi.joinGamers());
      setNotice("Gamer participation is enabled on your existing HOOMA profile.");
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to join Gamers"));
    } finally {
      setJoining(false);
    }
  }

  async function addGame(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setMemberError("");
    setNotice("");
    try {
      const created = await gamersApi.addGame({ name });
      setName("");
      setNotice(`${created.name} added to Gamers.`);
      await loadPublic();
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to add this game"));
    } finally {
      setCreating(false);
    }
  }

  async function loadMoreArena() {
    if (!arenaNextCursor || arenaLoadingMore) return;
    setArenaLoadingMore(true);
    setError("");
    try {
      const response = await gamersApi.arena(arenaNextCursor);
      setArenaMatches((current) => {
        const ids = new Set(current.map((match) => match.id));
        return [...current, ...response.items.filter((match) => !ids.has(match.id))];
      });
      setArenaNextCursor(response.nextCursor);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setArenaLoadingMore(false);
    }
  }

  function openChallenge(gamer: GamerDiscoveryItem) {
    if (!gamer.openToChallenge) return;
    setNotice("");
    setMemberError("");
    setWhistleProfileId(null);
    setChallengeTarget(gamer);
  }

  function toggleWhistle(gamer: GamerDiscoveryItem) {
    if (!me) {
      const href = authenticationHref("/gamers");
      if (href) window.location.assign(href);
      return;
    }
    if (!isGamer) {
      setMemberError("");
      setNotice("Join Gamers before sending a Gamer Whistle.");
      return;
    }
    setNotice("");
    setMemberError("");
    setWhistleProfileId((current) => (current === gamer.id ? null : gamer.id));
  }

  function renderCards(items: GamerDiscoveryItem[]) {
    if (loading && !items.length) {
      return (
        <div className="state-card">
          <strong>Loading gamers…</strong>
        </div>
      );
    }
    if (!items.length) {
      return (
        <div className="state-card">
          <strong>No gamers here yet.</strong>
          <p className="muted">Gamer cards appear from real game profiles in active games.</p>
        </div>
      );
    }
    return (
      <div className="gamer-challenger-grid">
        {items.map((gamer) => {
          const isOwn = me?.presentation.username === gamer.presentation.username;
          const whistleOpen = whistleProfileId === gamer.id;
          return (
            <GamerHudCard
              key={gamer.id}
              player={gamer}
              game={gamer.game}
              isOwn={isOwn}
              challengeLabel="Set up to challenge"
              challengeDisabled={!gamer.openToChallenge}
              whistleOpen={whistleOpen}
              whistleDisabled={!gamer.openToChallenge}
              onChallenge={() => openChallenge(gamer)}
              onToggleWhistle={() => toggleWhistle(gamer)}
              onCloseWhistle={() => setWhistleProfileId(null)}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="page gamers-page gamers-home-page">
      <header className="gamers-hero panel">
        <span className="eyebrow">HOOMA GAMERS</span>
        <h1>Find players. Whistle them. Challenge them.</h1>
        <p>
          Discover real HOOMA Gamers across the games they already play. HOOMA connects the people;
          gameplay stays inside the game.
        </p>
      </header>

      <nav className="gamers-home-tabs" aria-label="Gamers sections">
        <button
          className={activeTab === "GAMERS" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("GAMERS")}
        >
          GAMERS
        </button>
        <button
          className={activeTab === "CHALLENGERS" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("CHALLENGERS")}
        >
          CHALLENGERS
        </button>
        <button
          className={activeTab === "ARENA" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("ARENA")}
        >
          ARENA
        </button>
        <button
          className={activeTab === "CATALOG" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("CATALOG")}
        >
          GAME CATALOG
        </button>
      </nav>

      {notice ? <div className="success-box">{notice}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {memberError ? <div className="error-box">{memberError}</div> : null}

      <section className="panel gamers-join-panel" aria-labelledby="gamers-join-heading">
        {accountLoading ? <p className="muted">Checking your HOOMA account…</p> : null}
        {!accountLoading && me && !isGamer ? (
          <div className="member-gate">
            <strong id="gamers-join-heading">Join Gamers with your existing HOOMA profile.</strong>
            <span className="muted">
              This enables Gamer participation on your canonical HOOMA identity. It does not create
              a second account.
            </span>
            <button
              className="button"
              type="button"
              disabled={joining}
              onClick={() => void joinGamers()}
            >
              {joining ? "Joining…" : "Join Gamers"}
            </button>
          </div>
        ) : null}
        {!accountLoading && me && isGamer ? (
          <div className="gamers-member-state">
            <span className="eyebrow">GAMER ENABLED</span>
            <strong id="gamers-join-heading">{me.presentation.displayName}</strong>
            <span className="muted">Your Gamer identity belongs to this HOOMA account.</span>
          </div>
        ) : null}
        {!accountLoading && !me ? (
          <div className="member-gate">
            <strong id="gamers-join-heading">Join Gamers with a HOOMA account.</strong>
            <span className="muted">
              Create or sign in to one canonical HOOMA account, then enable Gamer participation.
            </span>
            {accountHref ? (
              <a className="button secondary" href={accountHref}>
                Create or sign in
              </a>
            ) : null}
          </div>
        ) : null}
      </section>

      {activeTab === "GAMERS" ? (
        <section className="gamers-section" aria-labelledby="gamers-discovery-heading">
          <div className="gamers-section-heading">
            <div>
              <span className="eyebrow">GAMERS</span>
              <h2 id="gamers-discovery-heading">Players across HOOMA</h2>
            </div>
            <span className="gamers-count">{gamers.length} profiles</span>
          </div>
          {renderCards(gamers)}
        </section>
      ) : null}

      {activeTab === "CHALLENGERS" ? (
        <section className="gamers-section" aria-labelledby="gamers-challengers-heading">
          <div className="gamers-section-heading">
            <div>
              <span className="eyebrow">CHALLENGERS</span>
              <h2 id="gamers-challengers-heading">Open to challenge now</h2>
            </div>
            <span className="gamers-count">{challengers.length} open</span>
          </div>
          {renderCards(challengers)}
        </section>
      ) : null}

      {activeTab === "ARENA" ? (
        <section className="gamers-section gamer-global-arena" aria-labelledby="gamers-arena-heading">
          <div className="gamers-section-heading">
            <div>
              <span className="eyebrow">ARENA</span>
              <h2 id="gamers-arena-heading">Accepted matches across HOOMA</h2>
            </div>
            <span className="gamers-count">{arenaMatches.length} loaded</span>
          </div>
          {loading && !arenaMatches.length ? (
            <div className="state-card">
              <strong>Loading Arena…</strong>
            </div>
          ) : !arenaMatches.length ? (
            <div className="state-card">
              <strong>No accepted Match Cards yet.</strong>
              <p className="muted">Accepted Gamer challenges from active games appear here.</p>
            </div>
          ) : (
            <>
              <div className="gamer-arena-grid gamer-global-arena-grid">
                {arenaMatches.map((match) => (
                  <GamerMatchCard
                    key={match.id}
                    status={match.status}
                    challenger={match.challenger}
                    challenged={match.challenged}
                    label="MATCH CARD"
                    game={match.game}
                    compact
                  />
                ))}
              </div>
              {arenaNextCursor ? (
                <button
                  className="button secondary gamer-arena-more"
                  type="button"
                  disabled={arenaLoadingMore}
                  onClick={() => void loadMoreArena()}
                >
                  {arenaLoadingMore ? "Loading…" : "Load more matches"}
                </button>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {activeTab === "CATALOG" ? (
        <>
          <section className="gamers-section" aria-labelledby="gamers-catalog-heading">
            <div className="gamers-section-heading">
              <div>
                <span className="eyebrow">GAME CATALOG</span>
                <h2 id="gamers-catalog-heading">Choose your game</h2>
              </div>
              <span className="gamers-count">{games.length} active</span>
            </div>

            {loading && !games.length ? (
              <div className="state-card">
                <strong>Loading games…</strong>
              </div>
            ) : null}
            {!loading && !games.length && !error ? (
              <div className="state-card">
                <strong>No active games yet.</strong>
              </div>
            ) : null}
            {games.length ? (
              <div className="gamers-grid">
                {games.map((game) => (
                  <a
                    className="gamer-game-card"
                    href={`/gamers/games/${encodeURIComponent(game.slug)}`}
                    key={game.id}
                  >
                    <span className="gamer-game-mark" aria-hidden="true">
                      {game.name.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <span className="eyebrow">ACTIVE GAME</span>
                      <h3>{game.name}</h3>
                      <p className="muted">Open the game hub for Challengers and Arena.</p>
                    </div>
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <section className="panel gamers-add-panel" aria-labelledby="gamers-add-heading">
            <div>
              <span className="eyebrow">MISSING A GAME?</span>
              <h2 id="gamers-add-heading">Add it to HOOMA</h2>
              <p className="muted">
                Legitimate community-added games join the same persisted catalog. Duplicate names
                are rejected at the source.
              </p>
            </div>
            {!accountLoading && me ? (
              <form className="gamers-add-form" onSubmit={addGame}>
                <label className="field">
                  <span>Game name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Example: Rocket League"
                    minLength={2}
                    maxLength={100}
                    required
                  />
                </label>
                <button className="button" type="submit" disabled={creating || !name.trim()}>
                  {creating ? "Adding…" : "Add Game"}
                </button>
              </form>
            ) : null}
            {!accountLoading && !me && accountHref ? (
              <a className="button secondary" href={accountHref}>
                Create HOOMA account to add a game
              </a>
            ) : null}
          </section>
        </>
      ) : null}

      {challengeTarget ? (
        <GamerChallengeSetupModal
          game={challengeTarget.game}
          challengedProfileId={challengeTarget.id}
          challengedName={challengeTarget.presentation.displayName}
          returnTo={`/gamers?challenge=${encodeURIComponent(challengeTarget.id)}&game=${encodeURIComponent(challengeTarget.game.slug)}`}
          onClose={() => setChallengeTarget(null)}
          onSent={async () => {
            setNotice(`Challenge sent to ${challengeTarget.presentation.displayName}.`);
            await loadPublic();
          }}
        />
      ) : null}
    </div>
  );
}
