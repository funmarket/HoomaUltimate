import { useEffect, useMemo, useState } from "react";
import type { PublicCommunitySummary, PublicTeamSummary } from "@hooma/frontend";

type EntityLoadState = "loading" | "ready" | "error";

export function ManagedEntities({
  communities,
  teams,
  communitiesState,
  teamsState,
}: {
  readonly communities: readonly PublicCommunitySummary[];
  readonly teams: readonly PublicTeamSummary[];
  readonly communitiesState: EntityLoadState;
  readonly teamsState: EntityLoadState;
}) {
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const selectedCommunity = useMemo(
    () => communities.find((community) => community.id === selectedCommunityId) ?? null,
    [communities, selectedCommunityId],
  );
  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  useEffect(() => {
    if (selectedCommunityId && !selectedCommunity) setSelectedCommunityId("");
  }, [selectedCommunity, selectedCommunityId]);

  useEffect(() => {
    if (selectedTeamId && !selectedTeam) setSelectedTeamId("");
  }, [selectedTeam, selectedTeamId]);

  return (
    <>
      <section className="panel admin-entity-section" id="communities">
        <div className="section-heading">
          <div>
            <p className="eyebrow">COMMUNITIES</p>
            <h2>Active HOOMAs</h2>
          </div>
          <span>{communitiesState === "ready" ? communities.length : "—"}</span>
        </div>
        <div className="admin-entity-picker">
          <label className="admin-entity-select-label">
            <span>Select a HOOMA to manage</span>
            <select
              className="admin-entity-select"
              value={selectedCommunityId}
              onChange={(event) => setSelectedCommunityId(event.currentTarget.value)}
              disabled={communitiesState !== "ready" || !communities.length}
            >
              <option value="">Select a HOOMA</option>
              {communitiesState === "ready"
                ? communities.map((community) => (
                    <option key={community.id} value={community.id}>
                      {community.name}
                      {community.houma || community.city
                        ? ` — ${community.houma || community.city}`
                        : ""}
                    </option>
                  ))
                : null}
            </select>
          </label>
          {communitiesState === "loading" ? <p className="muted">Loading active HOOMAs…</p> : null}
          {communitiesState === "error" ? (
            <p className="muted">Active HOOMAs are unavailable.</p>
          ) : null}
          {communitiesState === "ready" && !communities.length ? (
            <p className="muted">No active HOOMAs.</p>
          ) : null}
          {communitiesState === "ready" && selectedCommunity ? (
            <article className="admin-entity-detail">
              <div className="admin-entity-detail-copy">
                <strong>{selectedCommunity.name}</strong>
                <span>
                  {selectedCommunity.houma ||
                    selectedCommunity.city ||
                    `@${selectedCommunity.slug}`}
                </span>
                <small>@{selectedCommunity.slug}</small>
              </div>
              <a className="admin-link" href={`/hooma/${selectedCommunity.id}/edit`}>
                Edit / Delete
              </a>
            </article>
          ) : null}
        </div>
      </section>

      <section className="panel admin-entity-section" id="teams">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TEAMS</p>
            <h2>Active Teams</h2>
          </div>
          <span>{teamsState === "ready" ? teams.length : "—"}</span>
        </div>
        <div className="admin-entity-picker">
          <label className="admin-entity-select-label">
            <span>Select a Team to manage</span>
            <select
              className="admin-entity-select"
              value={selectedTeamId}
              onChange={(event) => setSelectedTeamId(event.currentTarget.value)}
              disabled={teamsState !== "ready" || !teams.length}
            >
              <option value="">Select a Team</option>
              {teamsState === "ready"
                ? teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                      {team.houma || team.city ? ` — ${team.houma || team.city}` : ""}
                    </option>
                  ))
                : null}
            </select>
          </label>
          {teamsState === "loading" ? <p className="muted">Loading active Teams…</p> : null}
          {teamsState === "error" ? <p className="muted">Active Teams are unavailable.</p> : null}
          {teamsState === "ready" && !teams.length ? (
            <p className="muted">No active Teams.</p>
          ) : null}
          {teamsState === "ready" && selectedTeam ? (
            <article className="admin-entity-detail">
              <div className="admin-entity-detail-copy">
                <strong>{selectedTeam.name}</strong>
                <span>{selectedTeam.houma || selectedTeam.city || `@${selectedTeam.slug}`}</span>
                <small>
                  @{selectedTeam.slug} · {selectedTeam._count.players} active player
                  {selectedTeam._count.players === 1 ? "" : "s"}
                </small>
              </div>
              <a className="admin-link" href={`/teams/${selectedTeam.id}/edit`}>
                Edit / Delete
              </a>
            </article>
          ) : null}
        </div>
      </section>
    </>
  );
}
