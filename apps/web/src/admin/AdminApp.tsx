import { useEffect, useState } from "react";
import {
  useHoomaFrontend,
  type PlatformAdminOverview,
  type PublicCommunitySummary,
  type PublicTeamSummary,
} from "@hooma/frontend";

export function AdminApp() {
  const { api } = useHoomaFrontend();
  const [overview, setOverview] = useState<PlatformAdminOverview | null>(null);
  const [communities, setCommunities] = useState<PublicCommunitySummary[]>([]);
  const [teams, setTeams] = useState<PublicTeamSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      api.platformAdmin.overview(),
      api.communities.publicList(),
      api.teams.publicList({ limit: 100 }),
    ])
      .then(([adminOverview, communityPage, teamPage]) => {
        setOverview(adminOverview);
        setCommunities(communityPage.items);
        setTeams(teamPage.items);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [api]);

  return (
    <section className="admin-control-room">
      <section className="auth-card">
        <p className="eyebrow">APP ADMIN</p>
        <h2>HOOMA Control Room</h2>
        <p className="muted">Global App Admin authority is separate from Founder, Coach and Assistant roles.</p>
        {overview ? (
          <dl>
            <div><dt>Users</dt><dd>{overview.users}</dd></div>
            <div><dt>Platform Admins</dt><dd>{overview.activePlatformAdmins}</dd></div>
            <div><dt>Audit entries</dt><dd>{overview.auditEntries}</dd></div>
          </dl>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <section className="panel admin-entity-section">
        <div className="section-heading"><div><p className="eyebrow">COMMUNITIES</p><h2>Active HOOMAs</h2></div><span>{communities.length}</span></div>
        <div className="admin-entity-list">
          {communities.map((community) => (
            <article className="admin-entity-row" key={community.id}>
              <div><strong>{community.name}</strong><span>{community.houma || community.city || `@${community.slug}`}</span></div>
              <a className="admin-link" href={`/hooma/${community.id}/edit`}>Edit / Delete</a>
            </article>
          ))}
          {!communities.length && !error ? <p className="muted">No active HOOMAs.</p> : null}
        </div>
      </section>

      <section className="panel admin-entity-section">
        <div className="section-heading"><div><p className="eyebrow">TEAMS</p><h2>Active Teams</h2></div><span>{teams.length}</span></div>
        <div className="admin-entity-list">
          {teams.map((team) => (
            <article className="admin-entity-row" key={team.id}>
              <div><strong>{team.name}</strong><span>{team.houma || team.city || `@${team.slug}`}</span></div>
              <a className="admin-link" href={`/teams/${team.id}/edit`}>Edit / Delete</a>
            </article>
          ))}
          {!teams.length && !error ? <p className="muted">No active Teams.</p> : null}
        </div>
      </section>
    </section>
  );
}
