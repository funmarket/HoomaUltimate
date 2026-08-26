import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import type { GamerGame, GamerProfile } from "@hooma/contracts/gamers";
import type { ProfileResponse } from "@hooma/contracts/profile";
import { useHoomaFrontend } from "../context";
import { createGamersApi } from "./api";
import { createGamerOnboardingApi } from "./onboarding";

export function GamerChallengeSetupModal({
  game,
  challengedProfileId,
  challengedName,
  returnTo,
  onClose,
  onSent,
}: {
  readonly game: Pick<GamerGame, "id" | "slug" | "name">;
  readonly challengedProfileId: string;
  readonly challengedName: string;
  readonly returnTo: string;
  readonly onClose: () => void;
  readonly onSent: () => void | Promise<void>;
}) {
  const { api, transport, authenticationHref, protectedError } = useHoomaFrontend();
  const gamersApi = useMemo(() => createGamersApi(transport), [transport]);
  const onboardingApi = useMemo(() => createGamerOnboardingApi(transport), [transport]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [identityProfile, setIdentityProfile] = useState<ProfileResponse | null>(null);
  const [gameProfile, setGameProfile] = useState<GamerProfile | null>(null);
  const [handle, setHandle] = useState("");
  const [openToChallenge, setOpenToChallenge] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const isGamer = identityProfile?.identities.includes("GAMER") ?? false;
  const accountHref = authenticationHref(returnTo);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api.identity
      .meOptional()
      .then(async (account) => {
        if (!active) return;
        setMe(account);
        if (!account) return;
        const [profile, perGame] = await Promise.all([
          onboardingApi.profile(),
          gamersApi.myProfile(game.id),
        ]);
        if (!active) return;
        setIdentityProfile(profile);
        setGameProfile(perGame);
        setHandle(perGame?.handle ?? "");
        setOpenToChallenge(perGame?.openToChallenge ?? false);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to prepare this challenge"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, game.id, gamersApi, onboardingApi, protectedError]);

  async function joinGamers() {
    setJoining(true);
    setError("");
    try {
      setIdentityProfile(await onboardingApi.joinGamers());
    } catch (reason) {
      setError(protectedError(reason, "Unable to join Gamers"));
    } finally {
      setJoining(false);
    }
  }

  async function sendChallenge() {
    setSending(true);
    setError("");
    try {
      await gamersApi.createChallenge(game.id, { challengedProfileId });
      await onSent();
      onClose();
    } catch (reason) {
      setError(protectedError(reason, "Unable to send challenge"));
    } finally {
      setSending(false);
    }
  }

  async function saveAndChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!handle.trim()) return;
    setSaving(true);
    setError("");
    try {
      const saved = await gamersApi.saveMyProfile(game.id, {
        handle: handle.trim(),
        openToChallenge,
      });
      setGameProfile(saved);
      await gamersApi.createChallenge(game.id, { challengedProfileId });
      await onSent();
      onClose();
    } catch (reason) {
      setError(protectedError(reason, "Unable to finish Gamer setup"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="gamer-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="gamer-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gamer-setup-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="gamer-setup-modal-heading">
          <div>
            <span className="eyebrow">SET UP TO CHALLENGE</span>
            <h2 id="gamer-setup-title">Challenge {challengedName}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close challenge setup">
            ×
          </button>
        </div>

        {loading ? <p className="muted">Checking your HOOMA account…</p> : null}

        {!loading && !me ? (
          <div className="gamer-setup-step">
            <strong>Use your HOOMA account to challenge.</strong>
            <p className="muted">
              Your challenge will stay attached to this Gamer while you create or sign in to your
              canonical HOOMA account.
            </p>
            {accountHref ? (
              <a className="button gamer-setup-primary" href={accountHref}>
                Create or sign in to HOOMA
              </a>
            ) : (
              <span className="muted">Open HOOMA through Telegram to authenticate.</span>
            )}
          </div>
        ) : null}

        {!loading && me && identityProfile && !isGamer ? (
          <div className="gamer-setup-step">
            <strong>Join Gamers with your existing HOOMA profile.</strong>
            <p className="muted">
              This enables Gamer participation on your canonical HOOMA identity. It does not create
              a second account.
            </p>
            <button
              className="button gamer-setup-primary"
              type="button"
              disabled={joining}
              onClick={() => void joinGamers()}
            >
              {joining ? "Joining…" : "Join Gamers"}
            </button>
          </div>
        ) : null}

        {!loading && me && identityProfile && isGamer && !gameProfile ? (
          <form className="gamer-setup-step gamer-setup-form" onSubmit={saveAndChallenge}>
            <strong>Add your {game.name} Gamer Tag.</strong>
            <p className="muted">
              This game-specific handle belongs to your existing HOOMA Gamer identity.
            </p>
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
            <button
              className="button gamer-setup-primary"
              type="submit"
              disabled={saving || !handle.trim()}
            >
              {saving ? "Setting up…" : "Save Gamer Tag & Challenge"}
            </button>
          </form>
        ) : null}

        {!loading && me && identityProfile && isGamer && gameProfile ? (
          <div className="gamer-setup-step">
            <strong>Ready with {gameProfile.handle}.</strong>
            <p className="muted">Send the challenge to {challengedName}.</p>
            <button
              className="button gamer-setup-primary"
              type="button"
              disabled={sending}
              onClick={() => void sendChallenge()}
            >
              {sending ? "Sending…" : "Send Challenge"}
            </button>
          </div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}
      </section>
    </div>
  );
}
