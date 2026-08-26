import type { ReactNode } from "react";
import type {
  GamerChallengeParticipant,
  GamerChallengeStatus,
  GamerGame,
} from "@hooma/contracts/gamers";
import "./gamer-match-card.css";

function GamerMatchParticipant({
  label,
  participant,
}: {
  readonly label: string;
  readonly participant: GamerChallengeParticipant;
}) {
  const fallback = participant.presentation.displayName.slice(0, 1).toUpperCase();
  return (
    <div className="gamer-match-participant">
      <div className="gamer-match-avatar">
        {participant.presentation.photoUrl ? (
          <img
            src={participant.presentation.photoUrl}
            alt={`${participant.presentation.displayName} profile`}
          />
        ) : (
          <span aria-hidden="true">{fallback}</span>
        )}
      </div>
      <div className="gamer-match-participant-copy">
        <small>{label}</small>
        <strong>{participant.presentation.displayName}</strong>
        <span>{participant.handle}</span>
      </div>
    </div>
  );
}

export function GamerMatchCard({
  status,
  challenger,
  challenged,
  label,
  game,
  compact = false,
  actions,
  showAcceptedNote = false,
}: {
  readonly status: GamerChallengeStatus;
  readonly challenger: GamerChallengeParticipant;
  readonly challenged: GamerChallengeParticipant;
  readonly label: string;
  readonly game?: Pick<GamerGame, "slug" | "name">;
  readonly compact?: boolean;
  readonly actions?: ReactNode;
  readonly showAcceptedNote?: boolean;
}) {
  return (
    <article
      className={`gamer-match-card status-${status.toLowerCase()}${compact ? " compact" : ""}`}
    >
      <div className="gamer-match-card-top">
        <span>{label}</span>
        <strong>{status}</strong>
      </div>
      {game ? (
        <a className="gamer-match-game" href={`/gamers/games/${encodeURIComponent(game.slug)}`}>
          GAME · {game.name}
        </a>
      ) : null}
      <div className="gamer-match-versus">
        <GamerMatchParticipant label="CHALLENGER" participant={challenger} />
        <b>VS</b>
        <GamerMatchParticipant label="CHALLENGED" participant={challenged} />
      </div>
      {actions}
      {showAcceptedNote && status === "ACCEPTED" ? (
        <p className="gamer-match-note">
          Accepted challenge = canonical HOOMA Match Card. Gameplay happens in the external game.
        </p>
      ) : null}
    </article>
  );
}
