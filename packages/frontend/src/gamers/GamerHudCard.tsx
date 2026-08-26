import type { GamerGame } from "@hooma/contracts/gamers";
import { GamerWhistlePanel } from "./GamerWhistlePanel";

export type GamerHudPlayer = {
  readonly id: string;
  readonly handle: string;
  readonly openToChallenge: boolean;
  readonly presentation: {
    readonly username: string;
    readonly displayName: string;
    readonly photoUrl: string | null;
  };
};

export function GamerHudCard({
  player,
  game,
  isOwn = false,
  challengeLabel,
  challengeDisabled = false,
  whistleOpen = false,
  whistleDisabled = false,
  onChallenge,
  onToggleWhistle,
  onCloseWhistle,
}: {
  readonly player: GamerHudPlayer;
  readonly game: Pick<GamerGame, "id" | "slug" | "name">;
  readonly isOwn?: boolean;
  readonly challengeLabel: string;
  readonly challengeDisabled?: boolean;
  readonly whistleOpen?: boolean;
  readonly whistleDisabled?: boolean;
  readonly onChallenge: () => void;
  readonly onToggleWhistle: () => void;
  readonly onCloseWhistle: () => void;
}) {
  return (
    <article className="gamer-challenger-card">
      <div className="gamer-card-hud-rail" aria-hidden="true">
        <span>PLAYER PROFILE</span>
        <b>///</b>
        <i />
      </div>
      <div className="gamer-card-profile-content">
        <div className="gamer-card-portrait-panel">
          <div className="gamer-avatar" aria-hidden="true">
            {player.presentation.photoUrl ? (
              <img src={player.presentation.photoUrl} alt="" />
            ) : (
              player.presentation.displayName.slice(0, 1).toUpperCase()
            )}
          </div>
          <span className={player.openToChallenge ? "gamer-open-badge" : "gamer-closed-badge"}>
            {player.openToChallenge ? "OPEN TO CHALLENGE" : "NOT OPEN TO CHALLENGE"}
          </span>
        </div>
        <div className="gamer-challenger-copy">
          <div className="gamer-challenger-heading">
            <span className="gamer-card-game-label">GAME · {game.name}</span>
            {isOwn ? <small>YOUR PROFILE</small> : null}
          </div>
          <div className="gamer-card-handle-block">
            <span>GAMER TAG</span>
            <p className="gamer-handle">{player.handle}</p>
          </div>
          <div className="gamer-card-identity-block">
            <span>HOOMA ID</span>
            <h3>{player.presentation.displayName}</h3>
            <p className="muted">@{player.presentation.username}</p>
          </div>
          <div className="gamer-card-signal" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </div>
      {!isOwn ? (
        <>
          <div className="gamer-card-actions">
            <button
              className={`gamer-whistle-button${whistleOpen ? " active" : ""}`}
              type="button"
              onClick={onToggleWhistle}
              aria-expanded={whistleOpen}
              disabled={whistleDisabled || !player.openToChallenge}
            >
              WHISTLE
            </button>
            <button
              className="button gamer-challenge-button"
              type="button"
              onClick={onChallenge}
              disabled={challengeDisabled || !player.openToChallenge}
            >
              {player.openToChallenge ? challengeLabel : "Not open"}
            </button>
          </div>
          {whistleOpen && player.openToChallenge ? (
            <GamerWhistlePanel
              otherProfileId={player.id}
              recipientName={player.presentation.displayName}
              onClose={onCloseWhistle}
            />
          ) : null}
        </>
      ) : null}
    </article>
  );
}
