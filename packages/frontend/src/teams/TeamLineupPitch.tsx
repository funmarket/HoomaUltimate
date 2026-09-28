import type { TeamLineupView, TeamRosterPlayer } from "../api";
import "./TeamLineupPitch.css";

type TeamLineupPitchProps = {
  readonly teamName: string;
  readonly lineup: TeamLineupView | null;
  readonly roster?: readonly TeamRosterPlayer[];
};

export function TeamLineupPitch({ teamName, lineup, roster = [] }: TeamLineupPitchProps) {
  const rosterByTeamPlayerId = new Map(roster.map((player) => [player.id, player]));
  const slots = lineup?.slots ?? [];
  const starterCount = slots.filter((slot) => slot.teamPlayerId && slot.isStarter).length;
  const hasStarters = starterCount > 0;
  const statusLabel = lineup?.published
    ? "Published"
    : hasStarters
      ? `${starterCount} starters`
      : lineup
        ? "Draft"
        : "Awaiting lineup";

  return (
    <section className="team-lineup-pitch" aria-label={`${teamName} lineup`}>
      <header className="team-lineup-header">
        <div className="team-lineup-identity">
          <span className="team-lineup-kicker">Matchday XI</span>
          <strong>{teamName}</strong>
        </div>
        <div className="team-lineup-status">
          <span className={lineup?.published ? "is-published" : "is-pending"}>{statusLabel}</span>
          <b>{lineup?.formation ?? "Unpublished"}</b>
        </div>
      </header>

      <div className="team-lineup-field">
        <div className="team-lineup-player-layer">
          {slots.map((slot) => {
            const rosterPlayer = slot.teamPlayerId
              ? rosterByTeamPlayerId.get(slot.teamPlayerId)
              : undefined;
            const displayName =
              rosterPlayer?.user.presentation?.displayName ??
              rosterPlayer?.user.presentation?.username ??
              slot.position;

            return (
              <span
                key={slot.id ?? `${slot.position}-${slot.sortOrder}`}
                className="team-lineup-player"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                title={displayName}
              >
                <span className="team-lineup-avatar" aria-hidden="true">
                  <b>{slot.sortOrder + 1}</b>
                </span>
                <span className="team-lineup-nameplate">
                  <small>{displayName}</small>
                  <em>{slot.position}</em>
                </span>
              </span>
            );
          })}
        </div>

        {!slots.length ? (
          <div className="team-lineup-empty">
            <span className="team-lineup-empty-mark">XI</span>
            <strong>Lineup not published.</strong>
            <small>Authorized Team staff can publish starters from the Coach Control Room.</small>
          </div>
        ) : null}
      </div>
    </section>
  );
}
