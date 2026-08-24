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
  const hasStarters = slots.some((slot) => Boolean(slot.teamPlayerId));

  return (
    <section className="team-lineup-pitch" aria-label={`${teamName} lineup`}>
      <header className="team-lineup-header">
        <div className="team-lineup-identity">
          <span className="team-lineup-kicker">Matchday XI</span>
          <strong>{teamName}</strong>
        </div>
        <div className="team-lineup-status">
          <span className={hasStarters ? "is-live" : "is-pending"}>
            {hasStarters
              ? `${slots.filter((slot) => slot.teamPlayerId && slot.isStarter).length} starters`
              : "Awaiting lineup"}
          </span>
          <b>{lineup?.formation ?? "Unpublished"}</b>
        </div>
      </header>

      <div className="team-lineup-field">
        <div className="team-lineup-floodlight team-lineup-floodlight-left" aria-hidden="true" />
        <div className="team-lineup-floodlight team-lineup-floodlight-right" aria-hidden="true" />
        <div className="team-lineup-goal team-lineup-goal-top" aria-hidden="true" />
        <div className="team-lineup-goal team-lineup-goal-bottom" aria-hidden="true" />
        <div className="team-lineup-center-circle" aria-hidden="true" />
        <div className="team-lineup-center-spot" aria-hidden="true" />

        {slots.map((slot) => {
          const rosterPlayer = slot.teamPlayerId ? rosterByTeamPlayerId.get(slot.teamPlayerId) : undefined;
          const displayName =
            rosterPlayer?.user.presentation?.displayName ??
            rosterPlayer?.user.presentation?.username ??
            slot.position;
          const photoUrl = rosterPlayer?.user.presentation?.photoUrl ?? null;
          const avatar = photoUrl ? <img src={photoUrl} alt="" /> : <b>{slot.sortOrder + 1}</b>;

          return (
            <span
              key={slot.id ?? `${slot.position}-${slot.sortOrder}`}
              className="team-lineup-player"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              title={displayName}
            >
              <span className="team-lineup-player-glow" aria-hidden="true" />
              <span className="team-lineup-avatar">{avatar}</span>
              <span className="team-lineup-nameplate">
                <small>{displayName}</small>
                <em>{slot.position}</em>
              </span>
            </span>
          );
        })}

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
