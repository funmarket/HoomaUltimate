import { useEffect, useMemo, useRef, useState } from "react";
import type {
  GamerDispute,
  GamerDisputeResolutionInput,
  GamerMatchSide,
  GamerMatchSubmission,
} from "@hooma/contracts/gamers";
import { createGamersApi, useHoomaFrontend } from "@hooma/frontend";
import "./gamer-disputes.css";

type ProofUrls = Record<string, Partial<Record<GamerMatchSide, string>>>;
type ProofLoadState = "loading" | "ready" | "error";
type ProofStates = Record<string, Partial<Record<GamerMatchSide, ProofLoadState>>>;
type QueueLoadState = "loading" | "ready" | "error";

function claimLabel(submission: GamerMatchSubmission | undefined): string {
  return submission
    ? `${submission.challengerScore}–${submission.challengedScore}`
    : "No submission";
}

function DisputeCard({
  dispute,
  proofUrls,
  proofStates,
  busy,
  onResolve,
}: {
  readonly dispute: GamerDispute;
  readonly proofUrls: Partial<Record<GamerMatchSide, string>>;
  readonly proofStates: Partial<Record<GamerMatchSide, ProofLoadState>>;
  readonly busy: boolean;
  readonly onResolve: (input: GamerDisputeResolutionInput) => void;
}) {
  const [notes, setNotes] = useState("");
  const challengerSubmission = dispute.submissions.find((item) => item.side === "CHALLENGER");
  const challengedSubmission = dispute.submissions.find((item) => item.side === "CHALLENGED");

  function proof(
    side: GamerMatchSide,
    submission: GamerMatchSubmission | undefined,
    playerLabel: string,
  ) {
    if (!submission) {
      return <div className="gamer-dispute-proof-missing">No {playerLabel} proof submitted</div>;
    }
    if (proofStates[side] === "error") {
      return <div className="gamer-dispute-proof-missing">{playerLabel} proof unavailable</div>;
    }
    if (proofStates[side] !== "ready" || !proofUrls[side]) {
      return <div className="gamer-dispute-proof-missing">Loading {playerLabel} proof…</div>;
    }
    return (
      <a href={proofUrls[side]} target="_blank" rel="noreferrer">
        <img src={proofUrls[side]} alt={`${playerLabel} submitted match proof`} />
      </a>
    );
  }

  function resolveFrom(submission: GamerMatchSubmission | undefined) {
    if (!submission || !notes.trim()) return;
    onResolve({
      decision: "SCORE",
      challengerScore: submission.challengerScore,
      challengedScore: submission.challengedScore,
      moderatorNotes: notes.trim(),
    });
  }

  return (
    <article className="gamer-dispute-card">
      <header>
        <div>
          <span className="eyebrow">{dispute.game.name}</span>
          <h3>Match {dispute.challengeId}</h3>
        </div>
        <strong>DISPUTED</strong>
      </header>
      <div className="gamer-dispute-evidence-grid">
        <section>
          <div className="gamer-dispute-player">
            <strong>{dispute.challenger.presentation.displayName}</strong>
            <span>{dispute.challenger.handle}</span>
            <b>Claim: {claimLabel(challengerSubmission)}</b>
          </div>
          {proof("CHALLENGER", challengerSubmission, "Challenger")}
        </section>
        <section>
          <div className="gamer-dispute-player">
            <strong>{dispute.challenged.presentation.displayName}</strong>
            <span>{dispute.challenged.handle}</span>
            <b>Claim: {claimLabel(challengedSubmission)}</b>
          </div>
          {proof("CHALLENGED", challengedSubmission, "Challenged player")}
        </section>
      </div>
      <div className="gamer-dispute-resolution">
        <label>
          <span>Moderator notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.currentTarget.value)}
            maxLength={2000}
            placeholder="Explain the evidence and final judgment"
          />
        </label>
        <div>
          <button
            type="button"
            disabled={busy || !notes.trim() || !challengerSubmission}
            onClick={() => resolveFrom(challengerSubmission)}
          >
            Use Challenger Claim
          </button>
          <button
            type="button"
            disabled={busy || !notes.trim() || !challengedSubmission}
            onClick={() => resolveFrom(challengedSubmission)}
          >
            Use Challenged Claim
          </button>
          <button
            className="secondary"
            type="button"
            disabled={busy || !notes.trim()}
            onClick={() => onResolve({ decision: "VOID", moderatorNotes: notes.trim() })}
          >
            Void Match
          </button>
        </div>
      </div>
    </article>
  );
}

export function GamerDisputeConsole({
  onCountChange,
  onQueueStateChange,
  onResolved,
}: {
  readonly onCountChange?: (count: number) => void;
  readonly onQueueStateChange?: (state: QueueLoadState) => void;
  readonly onResolved?: () => Promise<void> | void;
} = {}) {
  const { transport } = useHoomaFrontend();
  const gamersApi = useMemo(() => createGamersApi(transport), [transport]);
  const [disputes, setDisputes] = useState<GamerDispute[]>([]);
  const [proofUrls, setProofUrls] = useState<ProofUrls>({});
  const [proofStates, setProofStates] = useState<ProofStates>({});
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const [queueState, setQueueState] = useState<QueueLoadState>("loading");
  const [error, setError] = useState("");
  const resolvingInFlight = useRef<Set<string>>(new Set());

  async function load() {
    setQueueState("loading");
    onQueueStateChange?.("loading");

    let response: Awaited<ReturnType<typeof gamersApi.adminDisputes>>;
    try {
      response = await gamersApi.adminDisputes();
    } catch (reason) {
      setQueueState("error");
      onQueueStateChange?.("error");
      throw reason;
    }

    setDisputes(response.items);
    setQueueState("ready");
    onCountChange?.(response.items.length);
    onQueueStateChange?.("ready");

    const nextUrls: ProofUrls = {};
    const nextStates: ProofStates = {};
    response.items.forEach((dispute) => {
      dispute.submissions.forEach((submission) => {
        (nextStates[dispute.id] ??= {})[submission.side] = "loading";
      });
    });
    setProofStates(nextStates);
    await Promise.all(
      response.items.flatMap((dispute) =>
        (["CHALLENGER", "CHALLENGED"] as const).map(async (side) => {
          if (!dispute.submissions.some((item) => item.side === side)) return;
          try {
            const blob = await gamersApi.adminDisputeProof(dispute.id, side);
            (nextUrls[dispute.id] ??= {})[side] = URL.createObjectURL(blob);
            (nextStates[dispute.id] ??= {})[side] = "ready";
          } catch {
            (nextStates[dispute.id] ??= {})[side] = "error";
          }
        }),
      ),
    );
    setProofStates({ ...nextStates });
    setProofUrls((current) => {
      Object.values(current).forEach((bySide) =>
        Object.values(bySide).forEach((url) => {
          if (url) URL.revokeObjectURL(url);
        }),
      );
      return nextUrls;
    });
  }

  useEffect(() => {
    void load().catch((reason) =>
      setError(reason instanceof Error ? reason.message : "Unable to load Gamer disputes"),
    );
    return () => {
      Object.values(proofUrls).forEach((bySide) =>
        Object.values(bySide).forEach((url) => {
          if (url) URL.revokeObjectURL(url);
        }),
      );
    };
  }, [gamersApi]);

  async function resolve(matchId: string, input: GamerDisputeResolutionInput) {
    if (resolvingInFlight.current.has(matchId)) return;
    resolvingInFlight.current.add(matchId);
    setBusyIds((current) => new Set(current).add(matchId));
    setError("");
    try {
      await gamersApi.resolveAdminDispute(matchId, input);
      await load();
      await onResolved?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to resolve Gamer dispute");
    } finally {
      resolvingInFlight.current.delete(matchId);
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(matchId);
        return next;
      });
    }
  }

  return (
    <section className="panel gamer-dispute-console" id="gamers">
      <div className="section-heading">
        <div>
          <p className="eyebrow">GAMER DISPUTES</p>
          <h2>EA FC Match Evidence</h2>
        </div>
        <span>{queueState === "ready" ? disputes.length : "—"}</span>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {queueState === "loading" ? <p className="muted">Loading dispute queue…</p> : null}
      {queueState === "error" ? <p className="muted">Dispute queue is unavailable.</p> : null}
      {queueState === "ready" && !disputes.length ? (
        <p className="muted">Dispute queue is clear.</p>
      ) : null}
      <div className="gamer-dispute-list">
        {disputes.map((dispute) => (
          <DisputeCard
            key={dispute.id}
            dispute={dispute}
            proofUrls={proofUrls[dispute.id] ?? {}}
            proofStates={proofStates[dispute.id] ?? {}}
            busy={busyIds.has(dispute.id)}
            onResolve={(input) => void resolve(dispute.id, input)}
          />
        ))}
      </div>
    </section>
  );
}
