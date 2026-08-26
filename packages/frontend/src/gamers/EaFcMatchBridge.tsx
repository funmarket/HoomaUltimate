import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { GamerChallenge, GamerGame, GamerMatchSession } from "@hooma/contracts/gamers";
import { useHoomaFrontend } from "../context";
import { createGamersApi } from "./api";
import "./ea-fc-match-bridge.css";

const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const EA_FC_ANDROID_PACKAGE = "com.ea.gp.fifamobile";
const EA_FC_IOS_SCHEME = "easportsfcmobile://";

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unable to update the EA FC match";
}

function launchEaFcMobile(): void {
  const userAgent = navigator.userAgent;
  if (/android/i.test(userAgent)) {
    window.location.href = `intent://#Intent;package=${EA_FC_ANDROID_PACKAGE};end`;
    return;
  }
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    window.location.href = EA_FC_IOS_SCHEME;
    return;
  }
  window.alert(
    "Open this Match Card on your Android or iOS device to launch EA SPORTS FC Mobile.",
  );
}

export function EaFcMatchBridge({
  game,
  challenge,
  currentProfileId,
}: {
  readonly game: GamerGame;
  readonly challenge: GamerChallenge;
  readonly currentProfileId: string | null;
}) {
  const { transport, protectedError } = useHoomaFrontend();
  const gamers = useMemo(() => createGamersApi(transport), [transport]);
  const [session, setSession] = useState<GamerMatchSession | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [yourScore, setYourScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isHost = currentProfileId === challenge.challenger.id;
  const isParticipant =
    currentProfileId === challenge.challenger.id || currentProfileId === challenge.challenged.id;

  useEffect(() => {
    if (!isParticipant) return;
    let active = true;
    void gamers
      .match(game.id, challenge.id)
      .then((next) => {
        if (!active) return;
        setSession(next);
        setRoomCode(next.roomCode ?? "");
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to load EA FC match bridge"));
      });
    return () => {
      active = false;
    };
  }, [challenge.id, game.id, gamers, isParticipant, protectedError]);

  async function publishCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await gamers.setMatchCode(game.id, challenge.id, { roomCode });
      setSession(next);
      setRoomCode(next.roomCode ?? "");
      setNotice("Quick Match code published. Your opponent can copy it and launch FC Mobile.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to publish the EA FC room code"));
    } finally {
      setBusy(false);
    }
  }

  async function copyMatchInfo() {
    if (!session?.roomCode) return;
    setError("");
    try {
      await navigator.clipboard.writeText(
        `EA FC Handle: ${challenge.challenger.handle}\nQuick Match ID: ${session.roomCode}`,
      );
      setNotice("EA FC handle and Quick Match ID copied.");
    } catch (reason) {
      setError(message(reason));
    }
  }

  async function submitResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!proof) return;
    if (proof.size > MAX_PROOF_BYTES) {
      setError("Match screenshot must be 5 MB or smaller.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(proof.type)) {
      setError("Match proof must be JPEG, PNG, or WebP.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await gamers.submitMatchResult(game.id, challenge.id, {
        yourScore: Number(yourScore),
        opponentScore: Number(opponentScore),
        proof,
      });
      setSession(next);
      setNotice(
        next.submissions.length > 1
          ? "Both scorecards are in. HOOMA is reconciling the result."
          : "Scorecard submitted. Waiting for your opponent or the verification deadline.",
      );
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit the match scorecard"));
    } finally {
      setBusy(false);
    }
  }

  if (!isParticipant) return null;

  const ownSide = isHost ? "CHALLENGER" : "CHALLENGED";
  const ownSubmission = session?.submissions.find((submission) => submission.side === ownSide);
  const resultLocked = session
    ? ["VERIFIED", "DISPUTED", "VOIDED"].includes(session.status)
    : false;

  return (
    <section className="ea-fc-bridge" aria-label="EA SPORTS FC Mobile match bridge">
      <div className="ea-fc-bridge-heading">
        <div>
          <small>EA SPORTS FC MOBILE BRIDGE</small>
          <strong>{session?.status.replaceAll("_", " ") ?? "LOADING"}</strong>
        </div>
        {session?.roomCode ? <code>{session.roomCode}</code> : null}
      </div>

      {isHost && session?.status === "WAITING_FOR_CODE" ? (
        <form className="ea-fc-code-form" onSubmit={publishCode}>
          <label>
            <span>6-digit Quick Match ID</span>
            <input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={roomCode}
              onChange={(event) =>
                setRoomCode(event.currentTarget.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="582910"
              required
            />
          </label>
          <button className="button" type="submit" disabled={busy || !/^\d{6}$/.test(roomCode)}>
            Publish Match ID
          </button>
        </form>
      ) : null}

      {session?.roomCode ? (
        <div className="ea-fc-handoff-actions">
          <button className="button secondary" type="button" onClick={() => void copyMatchInfo()}>
            Copy Info
          </button>
          <button className="button" type="button" onClick={launchEaFcMobile}>
            Launch Game
          </button>
        </div>
      ) : !isHost ? (
        <p className="muted">Waiting for the challenger to publish the EA FC Quick Match ID.</p>
      ) : null}

      {session?.roomCode && !resultLocked ? (
        <form className="ea-fc-result-form" onSubmit={submitResult}>
          <strong>{ownSubmission ? "Update your scorecard" : "Submit your scorecard"}</strong>
          <div className="ea-fc-score-grid">
            <label>
              <span>Your score</span>
              <input
                type="number"
                min={0}
                max={99}
                value={yourScore}
                onChange={(event) => setYourScore(event.currentTarget.value)}
                required
              />
            </label>
            <span>:</span>
            <label>
              <span>Opponent</span>
              <input
                type="number"
                min={0}
                max={99}
                value={opponentScore}
                onChange={(event) => setOpponentScore(event.currentTarget.value)}
                required
              />
            </label>
          </div>
          <label className="ea-fc-proof-input">
            <span>Final score screenshot · JPEG, PNG or WebP · max 5 MB</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setProof(event.currentTarget.files?.[0] ?? null)}
              required
            />
          </label>
          <button className="button" type="submit" disabled={busy || !proof}>
            {busy ? "Submitting…" : "Submit Result"}
          </button>
        </form>
      ) : null}

      {session?.status === "VERIFIED" ? (
        <p className="success-box">
          Verified result: {session.finalChallengerScore}–{session.finalChallengedScore}
        </p>
      ) : null}
      {session?.status === "DISPUTED" ? (
        <p className="error-box">
          The scorecards conflict. This Match Card is locked for App Admin review.
        </p>
      ) : null}
      {session?.status === "VOIDED" ? (
        <p className="muted">This match was voided by App Admin.</p>
      ) : null}
      {notice ? <p className="ea-fc-notice">{notice}</p> : null}
      {error ? <p className="error-box">{error}</p> : null}
    </section>
  );
}
