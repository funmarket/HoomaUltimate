import { useEffect, useMemo, useState } from "react";
import type { GamerGame, GamerProfile, GamerPublicProfile } from "@hooma/contracts/gamers";
import type { MeResponse } from "@hooma/contracts";
import { useHoomaFrontend } from "../context";
import { createGamersApi } from "./api";

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected Gamers error";
}

export function GamerProfilePage({
  gameSlug,
  profileId,
}: {
  readonly gameSlug: string;
  readonly profileId: string;
}) {
  const { api, transport, authenticationHref, protectedError } = useHoomaFrontend();
  const gamersApi = useMemo(() => createGamersApi(transport), [transport]);
  const [game, setGame] = useState<GamerGame | null>(null);
  const [publicProfile, setPublicProfile] = useState<GamerPublicProfile | null>(null);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [myProfile, setMyProfile] = useState<GamerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void gamersApi
      .game(gameSlug)
      .then(async (nextGame) => {
        const profile = await gamersApi.publicProfile(nextGame.id, profileId);
        if (!active) return;
        setGame(nextGame);
        setPublicProfile(profile);
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
  }, [gameSlug, gamersApi, profileId]);

  useEffect(() => {
    let active = true;
    void api.identity
      .meOptional()
      .then((response) => {
        if (active) setMe(response);
      })
      .catch(() => {
        if (active) setMe(null);
      });
    return () => {
      active = false;
    };
  }, [api]);

  useEffect(() => {
    if (!game || !me) {
      setMyProfile(null);
      return;
    }
    let active = true;
    void gamersApi
      .myProfile(game.id)
      .then((profile) => {
        if (active) setMyProfile(profile);
      })
      .catch(() => {
        if (active) setMyProfile(null);
      });
    return () => {
      active = false;
    };
  }, [game, gamersApi, me]);

  async function sendChallenge() {
    if (!game || !publicProfile) return;
    if (!me) {
      const href = authenticationHref(
        `/gamers/games/${encodeURIComponent(gameSlug)}/profiles/${encodeURIComponent(profileId)}`,
      );
      if (href) window.location.assign(href);
      return;
    }
    setActionLoading(true);
    setError("");
    setNotice("");
    try {
      await gamersApi.createChallenge(game.id, { challengedProfileId: publicProfile.id });
      setNotice("Challenge sent. Open Arena from the game hub to follow its status.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to send challenge"));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="page gamers-page gamer-profile-page">
        <div className="state-card">
          <strong>Loading gamer profile…</strong>
        </div>
      </div>
    );
  }

  if (!game || !publicProfile) {
    return (
      <div className="page gamers-page gamer-profile-page">
        <div className="error-box">{error || "Gamer profile not found"}</div>
      </div>
    );
  }

  const isOwnProfile = myProfile?.id === publicProfile.id;

  return (
    <div className="page gamers-page gamer-profile-page">
      <a className="gamer-back-link" href={`/gamers/games/${encodeURIComponent(game.slug)}`}>
        ← {game.name}
      </a>
      {notice ? <div className="success-box">{notice}</div> : null}
      {error ? <div className="error-box">{error}</div> : null}

      <article className="gamer-profile-showcase panel">
        <div className="gamer-profile-glow" aria-hidden="true" />
        <div className="gamer-profile-photo" aria-hidden="true">
          {publicProfile.presentation.photoUrl ? (
            <img src={publicProfile.presentation.photoUrl} alt="" />
          ) : (
            publicProfile.presentation.displayName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="gamer-profile-main">
          <span className="eyebrow">{game.name.toUpperCase()} PLAYER</span>
          <h1>{publicProfile.presentation.displayName}</h1>
          <p className="gamer-profile-username">@{publicProfile.presentation.username}</p>
          <div className="gamer-profile-handle-block">
            <small>GAME HANDLE</small>
            <strong>{publicProfile.handle}</strong>
          </div>
          {publicProfile.presentation.bio ? (
            <p className="gamer-profile-bio">{publicProfile.presentation.bio}</p>
          ) : null}
          <div className="gamer-profile-status-row">
            <span
              className={publicProfile.openToChallenge ? "gamer-open-badge" : "gamer-closed-badge"}
            >
              {publicProfile.openToChallenge ? "OPEN TO CHALLENGE" : "NOT OPEN TO CHALLENGE"}
            </span>
            {isOwnProfile ? <span className="gamer-self-badge">YOUR PROFILE</span> : null}
          </div>
          {!isOwnProfile && publicProfile.openToChallenge ? (
            <button
              className="button gamer-profile-challenge"
              type="button"
              disabled={actionLoading}
              onClick={() => void sendChallenge()}
            >
              {actionLoading ? "Sending…" : "Challenge"}
            </button>
          ) : null}
          {!isOwnProfile && !publicProfile.openToChallenge ? (
            <p className="muted">This gamer is not accepting new challenges right now.</p>
          ) : null}
        </div>
      </article>
    </div>
  );
}
