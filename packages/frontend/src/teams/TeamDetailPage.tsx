import { useEffect, useMemo, useState } from "react";
import { useHoomaFrontend } from "../context";
import type { ManagedTeam, TeamControlDetail } from "../api";
import { TeamLineupPitch } from "./TeamLineupPitch";

function report(reason: unknown): string {
  return reason instanceof Error ? reason.message : "Unexpected Team error";
}

export function TeamDetailPage({ teamId }: { readonly teamId: string }) {
  const { api } = useHoomaFrontend();
  const [team, setTeam] = useState<TeamControlDetail | null>(null);
  const [managedTeams, setManagedTeams] = useState<ManagedTeam[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void api.teams
      .publicDetail(teamId)
      .then((response) => {
        if (active) setTeam(response);
      })
      .catch((reason) => {
        if (active) setError(report(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void api.teams
      .managed()
      .then((response) => {
        if (active) setManagedTeams(response);
      })
      .catch(() => {
        if (active) setManagedTeams([]);
      });
    return () => {
      active = false;
    };
  }, [api, teamId]);

  const roleByUser = useMemo(
    () => new Map(team?.responsibilities.map((row) => [row.userId, row.role] as const) ?? []),
    [team]
  );
  const canManage = managedTeams.some((candidate) => candidate.id === teamId);
  const publishedLineup = team?.lineups?.[0] ?? null;

  if (error) return <div className="error-box">{error}</div>;
  if (loading || !team) return <div className="state-card"><strong>Loading Team…</strong></div>;

  const heroStyle = team.bannerUrl
    ? {
        backgroundImage: `linear-gradient(90deg, rgba(8,8,8,.92), rgba(8,8,8,.62)), url(${JSON.stringify(team.bannerUrl).slice(1, -1)})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }
    : undefined;

  return (
    <div className="page team-profile-page">
      <section className="team-profile-hero" style={heroStyle}>
        <div className="team-profile-badge">
          {team.badgeUrl ? <img src={team.badgeUrl} alt={`${team.name} badge`} /> : team.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="team-profile-copy">
          <span className="eyebrow">TEAM PROFILE</span>
          <h1>{team.name}</h1>
          <p>{team.motto || "Ready for the next challenge."}</p>
          <small>{[team.houma, team.city].filter(Boolean).join(" · ") || "Location TBA"}</small>
        </div>
        <div className="team-profile-actions">
          {canManage ? <a className="button" href="/teams/control">Coach Control Room</a> : null}
          <a className="button secondary" href="/teams">Back to Teams</a>
        </div>
      </section>

      <section className="panel">
        <span className="eyebrow">MATCHDAY XI</span>
        <h2>Published lineup</h2>
        <TeamLineupPitch teamName={team.name} lineup={publishedLineup} roster={team.players} />
      </section>

      <div className="two-col team-profile-grid">
        <section className="panel">
          <span className="eyebrow">SQUAD</span>
          <h2>Active players</h2>
          <div className="list">
            {team.players.length
              ? team.players.map((player) => {
                  const presentation = player.user.presentation;
                  const role = roleByUser.get(player.userId) ?? "PLAYER";
                  return (
                    <div className="list-row" key={player.userId}>
                      <div className="team-player-identity">
                        <strong>{presentation?.displayName ?? "Player"}</strong>
                        <small>{presentation?.username ? `@${presentation.username}` : "HOOMA player"}</small>
                      </div>
                      <span className={role === "COACH" ? "chip gold" : role === "ASSISTANT" ? "chip selected" : "chip"}>{role}</span>
                    </div>
                  );
                })
              : <p className="muted">No active players yet.</p>}
          </div>
        </section>
        <section className="panel">
          <span className="eyebrow">LEADERSHIP</span>
          <h2>Responsibilities</h2>
          <div className="list">
            {team.responsibilities.length
              ? team.responsibilities.map((responsibility) => (
                  <div className="list-row" key={`${responsibility.userId}-${responsibility.role}`}>
                    <div className="team-player-identity">
                      <strong>{responsibility.user.presentation?.displayName ?? "Team leader"}</strong>
                      <small>
                        {responsibility.user.presentation?.username
                          ? `@${responsibility.user.presentation.username}`
                          : "HOOMA member"}
                      </small>
                    </div>
                    <span className={responsibility.role === "COACH" ? "chip gold" : "chip selected"}>{responsibility.role}</span>
                  </div>
                ))
              : <p className="muted">No active Team responsibilities are published.</p>}
          </div>
          {team.community ? (
            <div className="team-community-note">
              <span>HOOMA Community</span>
              <strong>{team.community.name}</strong>
            </div>
          ) : null}
        </section>
      </div>

      <section className="panel team-public-boundary">
        <span className="eyebrow">PUBLIC TEAM</span>
        <h2>Challenge this side</h2>
        <p className="muted">
          Challenge creation and Team management remain protected member actions. Server-side Team capability rules decide who can act.
        </p>
        <a className="button secondary" href={canManage ? "/teams/control" : "/teams"}>
          {canManage ? "Open Team controls" : "Browse opponents"}
        </a>
      </section>
    </div>
  );
}
