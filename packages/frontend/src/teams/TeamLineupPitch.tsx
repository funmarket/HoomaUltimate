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
  const statusLabel = lineup?.published
    ? "Published"
    : lineup
      ? starterCount > 0
        ? `${starterCount} starters`
        : "Draft"
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
        {slots.map((slot) => {
          const isEmptySlot = slot.teamPlayerId === null;
          const rosterPlayer = slot.teamPlayerId
            ? rosterByTeamPlayerId.get(slot.teamPlayerId)
            : undefined;
          const isUnresolvedSlot = Boolean(slot.teamPlayerId) && !rosterPlayer;
          const displayName =
            rosterPlayer?.user.presentation?.displayName ??
            rosterPlayer?.user.presentation?.username ??
            null;
          const photoUrl = rosterPlayer?.user.presentation?.photoUrl ?? null;
          const playerStateClass = isUnresolvedSlot
            ? " team-lineup-player--unresolved"
            : isEmptySlot
              ? " team-lineup-player--empty"
              : " team-lineup-player--assigned";
          const title = isUnresolvedSlot
            ? `Unavailable player - ${slot.position}`
            : displayName
              ? `${displayName} - ${slot.position}`
              : `Open ${slot.position} slot`;

          return (
            <span
              key={slot.id ?? `${slot.position}-${slot.sortOrder}`}
              className={`team-lineup-player${playerStateClass}`}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
              title={title}
            >
              <span className="team-lineup-avatar">
                {isUnresolvedSlot ? (
                  <b aria-hidden="true">!</b>
                ) : photoUrl ? (
                  <img src={photoUrl} alt="" />
                ) : (
                  <b>{slot.sortOrder + 1}</b>
                )}
              </span>
              <span className="team-lineup-nameplate">
                {isUnresolvedSlot ? <small>Unavailable player</small> : null}
                {!isEmptySlot && !isUnresolvedSlot && displayName ? (
                  <small>{displayName}</small>
                ) : null}
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
