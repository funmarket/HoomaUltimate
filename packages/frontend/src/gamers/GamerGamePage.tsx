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
import { createGamerOnboardingApi, gamerOptInProfileInput } from "./onboarding";

type HubTab = "CHALLENGERS" | "ARENA";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected Gamers error";
}

function initialPendingChallengeProfileId(): string | null {
  const url = new URL(window.location.href);
  const profileId = url.searchParams.get("challenge");
  if (!profileId) return null;
  url.searchParams.delete("challenge");
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  return profileId;
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
  const [pendingChallengeProfileId, setPendingChallengeProfileId] = useState<string | null>(
    initialPendingChallengeProfileId,
  );
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

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void gamersApi
      .game(gameSlug)
      .then(async (nextGame) => {
        if (!active) return;
        setGame(nextGame);
        try {
          const response = await gamersApi.challengers(nextGame.id);
          if (active) setChallengers(response.items);
        } catch (reason) {
          if (active) setError(errorMessage(reason));
        }
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
    let active = true;
    setAccountLoading(true);
    void api.identity
      .meOptional()
      .then((response) => {
        if (active) setMe(response);
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
  }, [api]);

  useEffect(() => {
    if (!game || !me) {
      setIdentityProfile(null);
      setProfile(null);
      setChallenges([]);
      setHandle("");
      setOpenToChallenge(false);
      setIdentityLoading(false);
      return;
    }
    let active = true;
    setIdentityLoading(true);
    setMemberError("");
    void Promise.all([
      onboardingApi.profile(),
      gamersApi.myProfile(game.id),
      gamersApi.challenges(game.id),
    ])
      .then(([identityResponse, profileResponse, challengeResponse]) => {
        if (!active) return;
        setIdentityProfile(identityResponse);
        setProfile(profileResponse);
        setHandle(profileResponse?.handle ?? "");
        setOpenToChallenge(profileResponse?.openToChallenge ?? false);
        setChallenges(challengeResponse.items);
      })
      .catch((reason) => {
        if (active) setMemberError(protectedError(reason, "Unable to load your game activity"));
      })
      .finally(() => {
        if (active) setIdentityLoading(false);
      });
    return () => {
      active = false;
    };
  }, [game, gamersApi, me, onboardingApi, protectedError]);

  useEffect(() => {
    if (!pendingChallengeProfileId || !game || !me || identityLoading) return;
    if (!isGamer || !profile) {
      setActiveTab("CHALLENGERS");
      setNotice(
        isGamer
          ? `Add your ${game.name} handle above and this challenge will continue automatically.`
          : "Join Gamers above, then add your game handle. This challenge will continue automatically.",
      );
    }
  }, [game, identityLoading, isGamer, me, pendingChallengeProfileId, profile]);

  async function enableGamerIdentity(): Promise<boolean> {
    if (!identityProfile) return false;
    if (identityProfile.identities.includes("GAMER")) return true;
    setSaving(true);
    setMemberError("");
    try {
      const updated = await onboardingApi.updateProfile(gamerOptInProfileInput(identityProfile));
      setIdentityProfile(updated);
      return true;
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to enable Gamer participation"));
      return false;
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
      setPendingChallengeProfileId(null);
      setNotice("Challenge sent. It is now waiting for a response in Arena.");
      await loadChallenges(game.id);
      setActiveTab("ARENA");
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to send challenge"));
    } finally {
      setActionId("");
    }
  }

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
      if (pendingChallengeProfileId) {
        await sendChallengeNow(pendingChallengeProfileId);
      } else {
        setNotice("Your game profile is updated.");
      }
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to save your game profile"));
    } finally {
      setSaving(false);
    }
  }

  async function challengePlayer(challengedProfileId: string) {
    if (!game) return;
    if (!me) {
      const href = authenticationHref(`/gamers/games/${encodeURIComponent(gameSlug)}`);
      if (href) window.location.assign(href);
      return;
    }
    if (identityLoading) return;
    if (!isGamer || !profile) {
      setPendingChallengeProfileId(challengedProfileId);
      setActiveTab("CHALLENGERS");
      setMemberError("");
      setNotice(
        isGamer
          ? `Add your ${game.name} handle above and this challenge will continue automatically.`
          : "Join Gamers above, then add your game handle. This challenge will continue automatically.",
      );
      return;
    }
    await sendChallengeNow(challengedProfileId);
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
        if (!(await enableGamerIdentity())) return;
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

  async function joinGamers() {
    const enabled = await enableGamerIdentity();
    if (!enabled) return;
    if (profile && pendingChallengeProfileId) {
      await sendChallengeNow(pendingChallengeProfileId);
      return;
    }
    setNotice(
      profile
        ? "Gamer participation is enabled."
        : `Gamer participation is enabled. Add your ${game?.name ?? "game"} handle to continue.`,
    );
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
                <strong>Join Gamers with your existing HOOMA profile.</strong>
                <span className="muted">
                  This enables Gamer participation on your canonical HOOMA identity. It does not
                  create a second account.
                </span>
                <button
                  className="button"
                  type="button"
                  disabled={saving}
                  onClick={() => void joinGamers()}
                >
                  {saving ? "Joining…" : "Join Gamers"}
                </button>
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
                <strong>Challengers are public. Challenge actions use your HOOMA account.</strong>
                {signInHref ? (
                  <a className="button secondary" href={signInHref}>
                    Sign in
                  </a>
                ) : (
                  <span className="muted">Open HOOMA through Telegram to authenticate.</span>
                )}
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
                  return (
                    <article className="gamer-challenger-card" key={challenger.id}>
                      <a
                        className="gamer-card-profile-link"
                        href={`/gamers/games/${encodeURIComponent(game.slug)}/profiles/${encodeURIComponent(challenger.id)}`}
                        aria-label={`Open ${challenger.presentation.displayName} gamer profile`}
                      >
                        <div className="gamer-avatar" aria-hidden="true">
                          {challenger.presentation.photoUrl ? (
                            <img src={challenger.presentation.photoUrl} alt="" />
                          ) : (
                            challenger.presentation.displayName.slice(0, 1).toUpperCase()
                          )}
                        </div>
                        <div className="gamer-challenger-copy">
                          <div className="gamer-challenger-heading">
                            <span className="gamer-card-game-label">GAME · {game.name}</span>
                            <span className="gamer-open-badge">OPEN TO CHALLENGE</span>
                            {isOwn ? <small>YOUR PROFILE</small> : null}
                          </div>
                          <p className="gamer-handle">{challenger.handle}</p>
                          <h3>{challenger.presentation.displayName}</h3>
                          <p className="muted">@{challenger.presentation.username}</p>
                          <span className="gamer-card-profile-cue">OPEN PROFILE ›</span>
                        </div>
                      </a>
                      {!isOwn ? (
                        <button
                          className="button gamer-challenge-button"
                          type="button"
                          onClick={() => void challengePlayer(challenger.id)}
                          disabled={actionId === challenger.id || alreadyPending}
                        >
                          {actionId === challenger.id
                            ? "Sending…"
                            : alreadyPending
                              ? "Pending"
                              : profile && isGamer
                                ? "Challenge"
                                : "Set up to challenge"}
                        </button>
                      ) : null}
                    </article>
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
              <p className="muted">
                Send a challenge from a player card. Pending requests and accepted Match Cards
                appear here.
              </p>
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
                      <a
                        href={`/gamers/games/${encodeURIComponent(game.slug)}/profiles/${encodeURIComponent(challenge.challenger.id)}`}
                      >
                        <small>CHALLENGER</small>
                        <strong>{challenge.challenger.presentation.displayName}</strong>
                        <span>{challenge.challenger.handle}</span>
                      </a>
                      <b>VS</b>
                      <a
                        href={`/gamers/games/${encodeURIComponent(game.slug)}/profiles/${encodeURIComponent(challenge.challenged.id)}`}
                      >
                        <small>CHALLENGED</small>
                        <strong>{challenge.challenged.presentation.displayName}</strong>
                        <span>{challenge.challenged.handle}</span>
                      </a>
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
    </div>
  );
}
