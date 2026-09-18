import { useEffect, useMemo, useState } from "react";
import type { PublicCommunitySummary, PublicTeamSummary } from "@hooma/frontend";
import { AdminSelect } from "./AdminSelect";

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
  const communityOptions = useMemo(
    () =>
      communities.map((community) => ({
        value: community.id,
        label: community.name,
        description: community.houma || community.city || `@${community.slug}`,
      })),
    [communities],
  );
  const teamOptions = useMemo(
    () =>
      teams.map((team) => ({
        value: team.id,
        label: team.name,
        description: team.houma || team.city || `@${team.slug}`,
      })),
    [teams],
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
          <AdminSelect
            label="Select a HOOMA to manage"
            value={selectedCommunityId}
            options={communityOptions}
            placeholder="Select a HOOMA"
            disabled={communitiesState !== "ready" || !communities.length}
            onChange={setSelectedCommunityId}
          />
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
          <AdminSelect
            label="Select a Team to manage"
            value={selectedTeamId}
            options={teamOptions}
            placeholder="Select a Team"
            disabled={teamsState !== "ready" || !teams.length}
            onChange={setSelectedTeamId}
          />
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
