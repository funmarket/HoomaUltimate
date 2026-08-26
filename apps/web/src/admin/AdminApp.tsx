import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  AdminQueueItem,
  AppManagerSummary,
  PlatformManagerCapability,
} from "@hooma/contracts/platform-management";
import {
  createPlatformManagementApi,
  useHoomaFrontend,
  type PlatformAuditEntry,
  type PlatformOverview,
  type PublicCommunitySummary,
  type PublicTeamSummary,
} from "@hooma/frontend";
import "./admin.css";

const MANAGER_CAPABILITIES: readonly PlatformManagerCapability[] = [
  "REVIEW_PITCH_APPLICATIONS",
  "VIEW_AUDIT",
];

type QueueName = "places" | "place-ownership" | "pitch";

function QueueSection({
  title,
  eyebrow,
  items,
  onDecision,
}: {
  readonly title: string;
  readonly eyebrow: string;
  readonly items: readonly AdminQueueItem[];
  readonly onDecision: (id: string, decision: "APPROVE" | "REJECT") => void;
}) {
  return (
    <section className="panel admin-review-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <span>{items.length}</span>
      </div>
      <div className="admin-review-list">
        {items.map((item) => (
          <article className="admin-review-row" key={item.id}>
            <div>
              <strong>{item.place.name}</strong>
              <span>{item.place.houma || item.place.city || item.place.address}</span>
              <span>
                Submitted by {item.applicant.displayName} · @{item.applicant.username}
              </span>
              {item.summary ? <p>{item.summary}</p> : null}
              {item.evidence ? <p className="admin-review-evidence">{item.evidence}</p> : null}
            </div>
            <div className="admin-review-actions">
              <button type="button" onClick={() => onDecision(item.id, "APPROVE")}>
                Approve
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => onDecision(item.id, "REJECT")}
              >
                Reject
              </button>
            </div>
          </article>
        ))}
        {!items.length ? <p className="muted">Queue is clear.</p> : null}
      </div>
    </section>
  );
}

export function AdminApp() {
  const { api, transport } = useHoomaFrontend();
  const management = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [access, setAccess] = useState<{
    isPlatformOwner: boolean;
    managerCapabilities: readonly PlatformManagerCapability[];
  } | null>(null);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [communities, setCommunities] = useState<PublicCommunitySummary[]>([]);
  const [teams, setTeams] = useState<PublicTeamSummary[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [managers, setManagers] = useState<AppManagerSummary[]>([]);
  const [audit, setAudit] = useState<PlatformAuditEntry[]>([]);
  const [queues, setQueues] = useState<Record<QueueName, AdminQueueItem[]>>({
    places: [],
    "place-ownership": [],
    pitch: [],
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const selectedCommunity = useMemo(
    () => communities.find((community) => community.id === selectedCommunityId) ?? null,
    [communities, selectedCommunityId],
  );
  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId],
  );

  function can(capability: PlatformManagerCapability): boolean {
    return Boolean(access?.isPlatformOwner || access?.managerCapabilities.includes(capability));
  }

  async function load() {
    setError("");
    const currentAccess = await management.admin.access();
    setAccess(currentAccess);
    if (!currentAccess.isPlatformOwner && currentAccess.managerCapabilities.length === 0) return;

    const tasks: Promise<void>[] = [];
    const allowed = (capability: PlatformManagerCapability) =>
      currentAccess.isPlatformOwner || currentAccess.managerCapabilities.includes(capability);

    if (allowed("VIEW_AUDIT")) {
      tasks.push(
        Promise.all([management.admin.overview(), management.admin.audit()]).then(
          ([nextOverview, nextAudit]) => {
            setOverview(nextOverview);
            setAudit(nextAudit);
          },
        ),
      );
    }
    if (currentAccess.isPlatformOwner) {
      tasks.push(
        management.admin
          .queue("places")
          .then((rows) => setQueues((current) => ({ ...current, places: rows }))),
        management.admin
          .queue("place-ownership")
          .then((rows) => setQueues((current) => ({ ...current, "place-ownership": rows }))),
      );
    }
    if (allowed("REVIEW_PITCH_APPLICATIONS")) {
      tasks.push(
        management.admin
          .queue("pitch")
          .then((rows) => setQueues((current) => ({ ...current, pitch: rows }))),
      );
    }
    if (currentAccess.isPlatformOwner) {
      tasks.push(
        Promise.all([
          management.admin.managers(),
          api.communities.publicList(),
          api.teams.publicList({ limit: 100 }),
        ]).then(([managerRows, communityPage, teamPage]) => {
          setManagers(managerRows);
          setCommunities(communityPage.items);
          setTeams(teamPage.items);
          setSelectedCommunityId((current) =>
            communityPage.items.some((community) => community.id === current) ? current : "",
          );
          setSelectedTeamId((current) =>
            teamPage.items.some((team) => team.id === current) ? current : "",
          );
        }),
      );
    }
    await Promise.all(tasks);
  }

  useEffect(() => {
    void load().catch((reason: Error) => setError(reason.message));
  }, [api, management]);

  async function decide(queue: QueueName, id: string, decision: "APPROVE" | "REJECT") {
    const note =
      window.prompt(`${decision === "APPROVE" ? "Approval" : "Rejection"} note (optional)`) ?? "";
    setError("");
    setMessage("");
    try {
      await management.admin.decide(queue, id, { decision, note: note || null });
      setMessage("Decision saved and audited.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save decision");
    }
  }

  async function appointManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const username = String(data.get("username") ?? "").trim();
    const capabilities = MANAGER_CAPABILITIES.filter((capability) => data.get(capability) === "on");
    setError("");
    setMessage("");
    try {
      await management.admin.setManager(username, capabilities);
      event.currentTarget.reset();
      setMessage(
        capabilities.length ? "App Manager permissions saved." : "App Manager permissions revoked.",
      );
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update App Manager" );
    }
  }

  if (access && !access.isPlatformOwner && access.managerCapabilities.length === 0) {
    return (
      <section className="auth-card">
        <p className="eyebrow">CONTROL ROOM</p>
        <h2>Access required</h2>
        <p className="muted">This account has no App Manager permissions.</p>
      </section>
    );
  }

  return (
    <section className="admin-control-room">
      <section className="auth-card admin-hero">
        <p className="eyebrow">{access?.isPlatformOwner ? "APP ADMIN" : "APP MANAGER"}</p>
        <h1>HOOMA Control Room</h1>
        <p className="muted">
          {access?.isPlatformOwner
            ? "Full app authority. Only the configured App Admin account receives this role."
            : "Delegated authority is limited to the permissions assigned by the App Admin."}
        </p>
        {overview ? (
          <dl>
            <div>
              <dt>Users</dt>
              <dd>{overview.users}</dd>
            </div>
            <div>
              <dt>App Admins</dt>
              <dd>{overview.activePlatformAdmins}</dd>
            </div>
            <div>
              <dt>App Managers</dt>
              <dd>{overview.activeAppManagers}</dd>
            </div>
            <div>
              <dt>Audit entries</dt>
              <dd>{overview.auditEntries}</dd>
            </div>
          </dl>
        ) : null}
        {message ? <p className="status">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      {access?.isPlatformOwner ? (
        <QueueSection
          eyebrow="PLACES"
          title="Place submissions"
          items={queues.places}
          onDecision={(id, decision) => void decide("places", id, decision)}
        />
      ) : null}
      {access?.isPlatformOwner ? (
        <QueueSection
          eyebrow="OWNERSHIP"
          title="Place ownership claims"
          items={queues["place-ownership"]}
          onDecision={(id, decision) => void decide("place-ownership", id, decision)}
        />
      ) : null}
      {can("REVIEW_PITCH_APPLICATIONS") ? (
        <QueueSection
          eyebrow="PITCH"
          title="Pitch business applications"
          items={queues.pitch}
          onDecision={(id, decision) => void decide("pitch", id, decision)}
        />
      ) : null}

      {access?.isPlatformOwner ? (
        <section className="panel admin-manager-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">DELEGATION</p>
              <h2>App Managers</h2>
            </div>
            <span>{managers.length}</span>
          </div>
          <form className="admin-manager-form" onSubmit={(event) => void appointManager(event)}>
            <input name="username" placeholder="HOOMA username" required />
            <div className="admin-capability-grid">
              {MANAGER_CAPABILITIES.map((capability) => (
                <label key={capability}>
                  <input type="checkbox" name={capability} />
                  <span>{capability.replaceAll("_", " ")}</span>
                </label>
              ))}
            </div>
            <button type="submit">Save App Manager permissions</button>
            <p className="muted">
              Place submissions and ownership claims are App Admin-only. Submit with no permissions selected to revoke all App Manager access.
            </p>
          </form>
          <div className="admin-manager-list">
            {managers.map((manager) => (
              <article key={manager.userId}>
                <strong>{manager.displayName}</strong>
                <span>@{manager.username}</span>
                <small>{manager.capabilities.join(" · ")}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {access?.isPlatformOwner ? (
        <>
          <section className="panel admin-entity-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">COMMUNITIES</p>
                <h2>Active HOOMAs</h2>
              </div>
              <span>{communities.length}</span>
            </div>
            <div className="admin-entity-picker">
              <label className="admin-entity-select-label">
                <span>Select a HOOMA to manage</span>
                <select
                  className="admin-entity-select"
                  value={selectedCommunityId}
                  onChange={(event) => setSelectedCommunityId(event.currentTarget.value)}
                  disabled={!communities.length}
                >
                  <option value="">Select a HOOMA</option>
                  {communities.map((community) => (
                    <option key={community.id} value={community.id}>
                      {community.name}
                      {community.houma || community.city
                        ? ` — ${community.houma || community.city}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              {!communities.length ? <p className="muted">No active HOOMAs.</p> : null}
              {selectedCommunity ? (
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

          <section className="panel admin-entity-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TEAMS</p>
                <h2>Active Teams</h2>
              </div>
              <span>{teams.length}</span>
            </div>
            <div className="admin-entity-picker">
              <label className="admin-entity-select-label">
                <span>Select a Team to manage</span>
                <select
                  className="admin-entity-select"
                  value={selectedTeamId}
                  onChange={(event) => setSelectedTeamId(event.currentTarget.value)}
                  disabled={!teams.length}
                >
                  <option value="">Select a Team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                      {team.houma || team.city ? ` — ${team.houma || team.city}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              {!teams.length ? <p className="muted">No active Teams.</p> : null}
              {selectedTeam ? (
                <article className="admin-entity-detail">
                  <div className="admin-entity-detail-copy">
                    <strong>{selectedTeam.name}</strong>
                    <span>
                      {selectedTeam.houma || selectedTeam.city || `@${selectedTeam.slug}`}
                    </span>
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
      ) : null}

      {can("VIEW_AUDIT") ? (
        <section className="panel admin-audit-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">AUDIT</p>
              <h2>Recent sensitive actions</h2>
            </div>
            <span>{audit.length}</span>
          </div>
          <div className="admin-audit-list">
            {audit.map((entry) => (
              <article key={entry.id}>
                <strong>{entry.action}</strong>
                <span>
                  {entry.entityType}
                  {entry.entityId ? ` · ${entry.entityId}` : ""}
                </span>
                <time>{new Date(entry.createdAt).toLocaleString()}</time>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
