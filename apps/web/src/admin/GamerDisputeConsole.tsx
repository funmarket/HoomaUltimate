import { useEffect, useMemo, useState } from "react";
import type {
  GamerDispute,
  GamerDisputeResolutionInput,
  GamerMatchSide,
  GamerMatchSubmission,
} from "@hooma/contracts/gamers";
import { createGamersApi, useHoomaFrontend } from "@hooma/frontend";
import "./gamer-disputes.css";

type ProofUrls = Record<string, Partial<Record<GamerMatchSide, string>>>;

function claimLabel(submission: GamerMatchSubmission | undefined): string {
  return submission
    ? `${submission.challengerScore}–${submission.challengedScore}`
    : "No submission";
}

function DisputeCard({
  dispute,
  proofUrls,
  busy,
  onResolve,
}: {
  readonly dispute: GamerDispute;
  readonly proofUrls: Partial<Record<GamerMatchSide, string>>;
  readonly busy: boolean;
  readonly onResolve: (input: GamerDisputeResolutionInput) => void;
}) {
  const [notes, setNotes] = useState("");
  const challengerSubmission = dispute.submissions.find((item) => item.side === "CHALLENGER");
  const challengedSubmission = dispute.submissions.find((item) => item.side === "CHALLENGED");

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
          {proofUrls.CHALLENGER ? (
            <a href={proofUrls.CHALLENGER} target="_blank" rel="noreferrer">
              <img src={proofUrls.CHALLENGER} alt="Challenger submitted match proof" />
            </a>
          ) : (
            <div className="gamer-dispute-proof-missing">No challenger proof</div>
          )}
        </section>
        <section>
          <div className="gamer-dispute-player">
            <strong>{dispute.challenged.presentation.displayName}</strong>
            <span>{dispute.challenged.handle}</span>
            <b>Claim: {claimLabel(challengedSubmission)}</b>
          </div>
          {proofUrls.CHALLENGED ? (
            <a href={proofUrls.CHALLENGED} target="_blank" rel="noreferrer">
              <img src={proofUrls.CHALLENGED} alt="Challenged player submitted match proof" />
            </a>
          ) : (
            <div className="gamer-dispute-proof-missing">No challenged proof</div>
          )}
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

export function GamerDisputeConsole() {
  const { transport } = useHoomaFrontend();
  const gamersApi = useMemo(() => createGamersApi(transport), [transport]);
  const [disputes, setDisputes] = useState<GamerDispute[]>([]);
  const [proofUrls, setProofUrls] = useState<ProofUrls>({});
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const response = await gamersApi.adminDisputes();
    setDisputes(response.items);
    const nextUrls: ProofUrls = {};
    await Promise.all(
      response.items.flatMap((dispute) =>
        (["CHALLENGER", "CHALLENGED"] as const).map(async (side) => {
          if (!dispute.submissions.some((item) => item.side === side)) return;
          const blob = await gamersApi.adminDisputeProof(dispute.id, side);
          (nextUrls[dispute.id] ??= {})[side] = URL.createObjectURL(blob);
        }),
      ),
    );
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
    setBusyId(matchId);
    setError("");
    try {
      await gamersApi.resolveAdminDispute(matchId, input);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to resolve Gamer dispute");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="panel gamer-dispute-console">
      <div className="section-heading">
        <div>
          <p className="eyebrow">GAMER DISPUTES</p>
          <h2>EA FC Match Evidence</h2>
        </div>
        <span>{disputes.length}</span>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {!disputes.length ? <p className="muted">Dispute queue is clear.</p> : null}
      <div className="gamer-dispute-list">
        {disputes.map((dispute) => (
          <DisputeCard
            key={dispute.id}
            dispute={dispute}
            proofUrls={proofUrls[dispute.id] ?? {}}
            busy={busyId === dispute.id}
            onResolve={(input) => void resolve(dispute.id, input)}
          />
        ))}
      </div>
    </section>
  );
}
