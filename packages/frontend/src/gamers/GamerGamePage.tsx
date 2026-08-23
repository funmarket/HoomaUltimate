import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { GamerChallenger, GamerGame, GamerProfile } from "@hooma/contracts/gamers";
import type { MeResponse } from "@hooma/contracts";
import { useHoomaFrontend } from "../context";
import { createGamersApi } from "./api";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected Gamers error";
}

export function GamerGamePage({ gameSlug }: { readonly gameSlug: string }) {
  const { api, transport, authenticationHref, protectedError } = useHoomaFrontend();
  const gamersApi = useMemo(() => createGamersApi(transport), [transport]);
  const [game, setGame] = useState<GamerGame | null>(null);
  const [challengers, setChallengers] = useState<GamerChallenger[]>([]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [profile, setProfile] = useState<GamerProfile | null>(null);
  const [handle, setHandle] = useState("");
  const [openToChallenge, setOpenToChallenge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const [notice, setNotice] = useState("");

  const loadChallengers = useCallback(
    async (gameId: string) => {
      const response = await gamersApi.challengers(gameId);
      setChallengers(response.items);
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
      setProfile(null);
      setHandle("");
      setOpenToChallenge(false);
      return;
    }
    let active = true;
    setMemberError("");
    void gamersApi
      .myProfile(game.id)
      .then((response) => {
        if (!active) return;
        setProfile(response);
        setHandle(response?.handle ?? "");
        setOpenToChallenge(response?.openToChallenge ?? false);
      })
      .catch((reason) => {
        if (active) setMemberError(protectedError(reason, "Unable to load your game profile"));
      });
    return () => {
      active = false;
    };
  }, [game, gamersApi, me, protectedError]);

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
      setNotice("Your game profile is updated.");
      await loadChallengers(game.id);
    } catch (reason) {
      setMemberError(protectedError(reason, "Unable to save your game profile"));
    } finally {
      setSaving(false);
    }
  }

  const signInHref = authenticationHref(`/gamers/games/${encodeURIComponent(gameSlug)}`);

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
          Find real players, identify yourself by your game handle, and choose when you are open.
        </p>
      </header>

      <nav className="gamer-hub-tabs" aria-label={`${game.name} sections`}>
        <span className="gamer-hub-tab active">CHALLENGERS</span>
        <span className="gamer-hub-tab disabled" aria-disabled="true">
          SQUADS
        </span>
        <span className="gamer-hub-tab disabled" aria-disabled="true">
          ARENA
        </span>
        <span className="gamer-hub-tab disabled" aria-disabled="true">
          RANKINGS
        </span>
      </nav>

      {notice ? <div className="success-box">{notice}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      <section className="panel gamer-profile-editor" aria-labelledby="gamer-profile-heading">
        <div>
          <span className="eyebrow">YOUR GAME IDENTITY</span>
          <h2 id="gamer-profile-heading">Your {game.name} profile</h2>
          <p className="muted">
            This handle belongs only to this game. Your HOOMA name and photo still come from your
            main profile.
          </p>
        </div>
        {memberError ? <div className="error-box">{memberError}</div> : null}
        {accountLoading ? <p className="muted">Checking your HOOMA account…</p> : null}
        {!accountLoading && me ? (
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
            <strong>Challengers are public. Your game identity is private to your account.</strong>
            <span className="muted">
              Sign in only when you want to create your own game profile.
            </span>
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
            {challengers.map((challenger) => (
              <article className="gamer-challenger-card" key={challenger.id}>
                <div className="gamer-avatar" aria-hidden="true">
                  {challenger.presentation.photoUrl ? (
                    <img src={challenger.presentation.photoUrl} alt="" />
                  ) : (
                    challenger.presentation.displayName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="gamer-challenger-copy">
                  <div className="gamer-challenger-heading">
                    <div>
                      <span className="gamer-open-badge">OPEN TO CHALLENGE</span>
                      <h3>{challenger.presentation.displayName}</h3>
                    </div>
                    {profile?.id === challenger.id ? <small>YOUR PROFILE</small> : null}
                  </div>
                  <p className="gamer-handle">{challenger.handle}</p>
                  <p className="muted">@{challenger.presentation.username}</p>
                  <span className="gamer-next-action">
                    Challenge actions unlock with the Match Card slice.
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
