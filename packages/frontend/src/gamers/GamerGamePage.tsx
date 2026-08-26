import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import type { ProfileResponse } from "@hooma/contracts/profile";
import type {
  GamerChallenge,
  GamerChallenger,
  GamerGame,
  GamerProfile,
} from "@hooma/contracts/gamers";
import { useHoomaFrontend } from "../context";
import { createGamersApi } from "./api";
import { GamerChallengeSetupModal } from "./GamerChallengeSetupModal";
import { GamerHudCard } from "./GamerHudCard";
import { createGamerOnboardingApi } from "./onboarding";

type HubTab = "CHALLENGERS" | "ARENA";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected Gamers error";
}

function initialChallengeProfileId(): string | null {
  return new URL(window.location.href).searchParams.get("challenge");
}

export function GamerGamePage({ gameSlug }: { readonly gameSlug: string }) {
  const { api, transport, authenticationHref, protectedError } = useHoomaFrontend();
  const gamersApi = useMemo(() => createGamersApi(transport), [transport]);
  const onboardingApi = useMemo(() => createGamerOnboardingApi(transport), [transport]);
  const [game, setGame] = useState<GamerGame | null>(null);
  const [challengers, setChallengers] = useState<GamerChallenger[]>([]);
  const [challenges, setChallenges] = useState<GamerChallenge[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [identityProfile, setIdentityProfile] = useState<ProfileResponse | null>(null);
  const [profile, setProfile] = useState<GamerProfile | null>(null);
  const [handle, setHandle] = useState("");
  const [openToChallenge, setOpenToChallenge] = useState(false);
  const [challengeIntentId, setChallengeIntentId] = useState(initialChallengeProfileId);
  const [challengeTarget, setChallengeTarget] = useState<GamerChallenger | null>(null);
  const [whistleProfileId, setWhistleProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<HubTab>("CHALLENGERS");
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(true);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [notice, setNotice] = useState("");

  const isGamer = identityProfile?.identities.includes("GAMER") ?? false;

  const loadChallengers = useCallback(
    async (gameId: string) => {
      const response = await gamersApi.challengers(gameId);
      setChallengers(response.items);
    },
    [gamersApi],
  );

  const loadChallenges = useCallback(
    async (gameId: string) => {
      const response = await gamersApi.challenges(gameId);
      setChallenges(response.items);
    },
    [gamersApi],
  );

  const loadMemberState = useCallback(
    async (nextGame: GamerGame, account: MeResponse) => {
      setIdentityLoading(true);
      setMemberError("");
      try {
        const [identityResponse, profileResponse, challengeResponse] = await Promise.all([
          onboardingApi.profile(),
          gamersApi.myProfile(nextGame.id),
          gamersApi.challenges(nextGame.id),
        ]);
        setIdentityProfile(identityResponse);
        setProfile(profileResponse);
        setHandle(profileResponse?.handle ?? "");
        setOpenToChallenge(profileResponse?.openToChallenge ?? false);
        setChallenges(challengeResponse.items);
        setMe(account);
      } catch (reason) {
        setMemberError(protectedError(reason, "Unable to load your game activity"));
      } finally {
        setIdentityLoading(false);
      }
    },
    [gamersApi, onboardingApi, protectedError],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void gamersApi
      .game(gameSlug)
      .then(async (nextGame) => {
        if (!active) return;
        setGame(nextGame);
        const response = await gamersApi.challengers(nextGame.id);
        if (active) setChallengers(response.items);
      })
      .catch((reason) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [gameSlug, gamersApi]);

  useEffect(() => {
    if (!game) return;
    let active = true;
    setAccountLoading(true);
    void api.identity
      .meOptional()
      .then(async (account) => {
        if (!active) return;
        setMe(account);
        if (!account) {
          setIdentityProfile(null);
          setProfile(null);
          setChallenges([]);
          setHandle("");
          setOpenToChallenge(false);
          return;
        }
        await loadMemberState(game, account);
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
  }, [api, game, loadMemberState]);

  useEffect(() => {
    if (!challengeIntentId || !challengers.length) return;
    const target = challengers.find((challenger) => challenger.id === challengeIntentId);
    setChallengeIntentId(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("challenge");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (target) setChallengeTarget(target);
  }, [challengeIntentId, challengers]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!game) return;
    setSaving(true);
    setMemberError("");
    setNotice("");
    try {
      const saved = await gamersApi.saveMyProfile(game.id, { handle, openToChallenge });
      setProfile(saved);
      setHandle(saved.handle);
      setOpenToChallenge(saved.openToChallenge);
      await Promise.all([loadChallengers(game.id), loadChallenges(game.id)]);
      setNotice("Your game profile is updated.");
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to save your game profile"));
    } finally {
      setSaving(false);
    }
  }

  async function sendChallengeNow(challengedProfileId: string) {
    if (!game) return;
    setActionId(challengedProfileId);
    setMemberError("");
    setNotice("");
    try {
      await gamersApi.createChallenge(game.id, { challengedProfileId });
      setNotice("Challenge sent. It is now waiting for a response in Arena.");
      await loadChallenges(game.id);
      setActiveTab("ARENA");
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to send challenge"));
    } finally {
      setActionId("");
    }
  }

  function challengePlayer(challenger: GamerChallenger) {
    if (!game) return;
    if (me && isGamer && profile && !identityLoading) {
      void sendChallengeNow(challenger.id);
      return;
    }
    setNotice("");
    setMemberError("");
    setWhistleProfileId(null);
    setChallengeTarget(challenger);
  }

  function toggleWhistle(otherProfileId: string) {
    if (!game) return;
    if (!me) {
      const href = authenticationHref(`/gamers/games/${encodeURIComponent(gameSlug)}`);
      if (href) window.location.assign(href);
      return;
    }
    if (identityLoading) return;
    if (!isGamer || !profile) {
      setMemberError("");
      setNotice(
        isGamer
          ? `Add your ${game.name} handle before sending a Gamer Whistle.`
          : "Join Gamers from the Gamers homepage before sending a Gamer Whistle.",
      );
      return;
    }
    setNotice("");
    setMemberError("");
    setWhistleProfileId((current) => (current === otherProfileId ? null : otherProfileId));
  }

  async function updateChallenge(
    challenge: GamerChallenge,
    action: "accept" | "decline" | "cancel",
  ) {
    if (!game) return;
    setActionId(challenge.id);
    setMemberError("");
    setNotice("");
    try {
      if (action === "accept" && !isGamer) {
        setIdentityProfile(await onboardingApi.joinGamers());
      }
      if (action === "accept") await gamersApi.acceptChallenge(game.id, challenge.id);
      if (action === "decline") await gamersApi.declineChallenge(game.id, challenge.id);
      if (action === "cancel") await gamersApi.cancelChallenge(game.id, challenge.id);
      setNotice(
        action === "accept"
          ? "Challenge accepted. Your Match Card is live in Arena."
          : action === "decline"
            ? "Challenge declined."
            : "Challenge cancelled.",
      );
      await loadChallenges(game.id);
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to update challenge"));
    } finally {
      setActionId("");
    }
  }

  const signInHref = authenticationHref(`/gamers/games/${encodeURIComponent(gameSlug)}`);
  const pendingProfileIds = useMemo(() => {
    const ids = new Set<string>();
    challenges.forEach((challenge) => {
      if (challenge.status === "PENDING") {
        ids.add(challenge.challenger.id);
        ids.add(challenge.challenged.id);
      }
    });
    return ids;
  }, [challenges]);

  if (loading && !game) {
    return (
      <div className="page gamers-page gamer-game-page">
        <div className="state-card">
          <strong>Loading game…</strong>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="page gamers-page gamer-game-page">
        <div className="error-box">{error || "Game not found"}</div>
      </div>
    );
  }

  return (
    <div className="page gamers-page gamer-game-page">
      <header className="gamer-game-hero panel">
        <a className="gamer-back-link" href="/gamers">
          ← Gamers
        </a>
        <span className="eyebrow">GAME HUB</span>
        <h1>{game.name}</h1>
        <p>
          Build your game identity, find a real opponent, and take accepted challenges into Arena.
        </p>
      </header>

      <nav className="gamer-hub-tabs" aria-label={`${game.name} sections`}>
        <button
          className={`gamer-hub-tab${activeTab === "CHALLENGERS" ? " active" : ""}`}
          type="button"
          onClick={() => setActiveTab("CHALLENGERS")}
        >
          CHALLENGERS
        </button>
        <span className="gamer-hub-tab disabled" aria-disabled="true">
          SQUADS
        </span>
        <button
          className={`gamer-hub-tab${activeTab === "ARENA" ? " active" : ""}`}
          type="button"
          onClick={() => setActiveTab("ARENA")}
        >
          ARENA
        </button>
        <span className="gamer-hub-tab disabled" aria-disabled="true">
          RANKINGS
        </span>
      </nav>

      {notice ? <div className="success-box">{notice}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}
      {memberError ? <div className="error-box">{memberError}</div> : null}

      {activeTab === "CHALLENGERS" ? (
        <>
          <section className="panel gamer-profile-editor" aria-labelledby="gamer-profile-heading">
            <div>
              <span className="eyebrow">YOUR GAME IDENTITY</span>
              <h2 id="gamer-profile-heading">Your {game.name} profile</h2>
              <p className="muted">
                Your game handle belongs here. Your HOOMA name, photo and bio stay owned by your
                main profile.
              </p>
            </div>
            {accountLoading || identityLoading ? (
              <p className="muted">Checking your HOOMA account…</p>
            ) : null}
            {!accountLoading && !identityLoading && me && !isGamer ? (
              <div className="member-gate">
                <strong>Gamer participation is enabled from the Gamers homepage.</strong>
                <span className="muted">
                  Join once on your canonical HOOMA identity, then add game-specific handles here.
                </span>
                <a className="button secondary" href="/gamers">
                  Go to Gamers
                </a>
              </div>
            ) : null}
            {!accountLoading && !identityLoading && me && isGamer ? (
              <form className="gamer-profile-form" onSubmit={saveProfile}>
                <label className="field">
                  <span>Game username / handle</span>
                  <input
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                    placeholder={`Your ${game.name} handle`}
                    maxLength={100}
                    required
                  />
                </label>
                <label className="gamer-open-toggle">
                  <input
                    type="checkbox"
                    checked={openToChallenge}
                    onChange={(event) => setOpenToChallenge(event.target.checked)}
                  />
                  <span>
                    <strong>OPEN TO CHALLENGE</strong>
                    <small>Show this game profile in public Challengers.</small>
                  </span>
                </label>
                <button className="button" type="submit" disabled={saving || !handle.trim()}>
                  {saving ? "Saving…" : profile ? "Update Game Profile" : "Create Game Profile"}
                </button>
              </form>
            ) : null}
            {!accountLoading && !me ? (
              <div className="member-gate">
                <strong>Challengers are public. Gamer actions use your HOOMA account.</strong>
                {signInHref ? (
                  <a className="button secondary" href={signInHref}>
                    Sign in
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="gamers-section" aria-labelledby="challengers-heading">
            <div className="gamers-section-heading">
              <div>
                <span className="eyebrow">CHALLENGERS</span>
                <h2 id="challengers-heading">Players open to play</h2>
              </div>
              <span className="gamers-count">{challengers.length} open</span>
            </div>
            {!challengers.length ? (
              <div className="state-card">
                <strong>No challengers are open yet.</strong>
                <p className="muted">
                  Players appear here only after explicitly switching on OPEN TO CHALLENGE.
                </p>
              </div>
            ) : (
              <div className="gamer-challenger-grid">
                {challengers.map((challenger) => {
                  const isOwn = profile?.id === challenger.id;
                  const alreadyPending = pendingProfileIds.has(challenger.id) && !isOwn;
                  const whistleOpen = whistleProfileId === challenger.id;
                  return (
                    <GamerHudCard
                      key={challenger.id}
                      player={{ ...challenger, openToChallenge: true }}
                      game={game}
                      isOwn={isOwn}
                      challengeLabel={profile && isGamer ? "Challenge" : "Set up to challenge"}
                      challengeDisabled={actionId === challenger.id || alreadyPending}
                      whistleOpen={whistleOpen}
                      onChallenge={() => challengePlayer(challenger)}
                      onToggleWhistle={() => toggleWhistle(challenger.id)}
                      onCloseWhistle={() => setWhistleProfileId(null)}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="gamers-section gamer-arena" aria-labelledby="arena-heading">
          <div className="gamers-section-heading">
            <div>
              <span className="eyebrow">ARENA</span>
              <h2 id="arena-heading">Challenges & Match Cards</h2>
            </div>
            <span className="gamers-count">{challenges.length} total</span>
          </div>
          {!me ? (
            <div className="state-card">
              <strong>Sign in to enter your Arena.</strong>
              <p className="muted">
                Public challenger browsing stays open; challenge activity belongs to your account.
              </p>
            </div>
          ) : !challenges.length ? (
            <div className="state-card">
              <strong>No challenge activity yet.</strong>
              <p className="muted">Send a challenge from a Gamer card.</p>
            </div>
          ) : (
            <div className="gamer-arena-grid">
              {challenges.map((challenge) => {
                const incoming = profile?.id === challenge.challenged.id;
                const outgoing = profile?.id === challenge.challenger.id;
                return (
                  <article
                    className={`gamer-match-card status-${challenge.status.toLowerCase()}`}
                    key={challenge.id}
                  >
                    <div className="gamer-match-card-top">
                      <span>
                        {challenge.status === "ACCEPTED"
                          ? "MATCH CARD"
                          : incoming
                            ? "INCOMING CHALLENGE"
                            : "OUTGOING CHALLENGE"}
                      </span>
                      <strong>{challenge.status}</strong>
                    </div>
                    <div className="gamer-match-versus">
                      <div className="gamer-match-participant">
                        <small>CHALLENGER</small>
                        <strong>{challenge.challenger.presentation.displayName}</strong>
                        <span>{challenge.challenger.handle}</span>
                      </div>
                      <b>VS</b>
                      <div className="gamer-match-participant">
                        <small>CHALLENGED</small>
                        <strong>{challenge.challenged.presentation.displayName}</strong>
                        <span>{challenge.challenged.handle}</span>
                      </div>
                    </div>
                    {challenge.status === "PENDING" && incoming ? (
                      <div className="gamer-match-actions">
                        <button
                          className="button"
                          type="button"
                          disabled={actionId === challenge.id}
                          onClick={() => void updateChallenge(challenge, "accept")}
                        >
                          {isGamer ? "Accept" : "Rejoin & Accept"}
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          disabled={actionId === challenge.id}
                          onClick={() => void updateChallenge(challenge, "decline")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : null}
                    {challenge.status === "PENDING" && outgoing ? (
                      <button
                        className="button secondary"
                        type="button"
                        disabled={actionId === challenge.id}
                        onClick={() => void updateChallenge(challenge, "cancel")}
                      >
                        Cancel challenge
                      </button>
                    ) : null}
                    {challenge.status === "ACCEPTED" ? (
                      <p className="gamer-match-note">
                        Accepted challenge = canonical HOOMA Match Card. Gameplay happens in the
                        external game.
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {challengeTarget ? (
        <GamerChallengeSetupModal
          game={game}
          challengedProfileId={challengeTarget.id}
          challengedName={challengeTarget.presentation.displayName}
          returnTo={`/gamers/games/${encodeURIComponent(game.slug)}?challenge=${encodeURIComponent(challengeTarget.id)}`}
          onClose={() => setChallengeTarget(null)}
          onSent={async () => {
            const account = await api.identity.meOptional();
            if (account) await loadMemberState(game, account);
            await loadChallengers(game.id);
            setNotice("Challenge sent. It is now waiting for a response in Arena.");
            setActiveTab("ARENA");
          }}
        />
      ) : null}
    </div>
  );
}
