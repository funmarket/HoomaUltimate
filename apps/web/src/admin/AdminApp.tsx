import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AppManagerSummary, PlatformManagerCapability } from "@hooma/contracts/platform-admin";
import {
  createPlatformAdminApi,
  useHoomaFrontend,
  type AdminIssueSummary,
  type AdminUserDetail,
  type AdminUserSearchItem,
  type PlatformAuditEntry,
  type PlatformOverview,
  type PublicCommunitySummary,
  type PublicTeamSummary,
} from "@hooma/frontend";
import { AccessManagers, MANAGER_CAPABILITIES } from "./AccessManagers";
import { AuditArchive, type AuditArchiveFilters } from "./AuditArchive";
import {
  ControlRoomOverview,
  type AttentionItem,
  type AttentionLoadState,
} from "./ControlRoomOverview";
import { ControlRoomShell } from "./ControlRoomShell";
import { GamerDisputeConsole } from "./GamerDisputeConsole";
import { ManagedEntities } from "./ManagedEntities";
import { ReviewQueues, type AdminQueueStates, type AdminQueues } from "./ReviewQueues";
import "./admin.css";

type QueueName = "places" | "place-ownership" | "pitch";
type LoadState = "loading" | "ready" | "error";

const EMPTY_AUDIT_FILTERS: AuditArchiveFilters = {
  actor: "",
  action: "",
  entityType: "",
  from: "",
  to: "",
};

function AdminUsers({
  users,
  detail,
  loadState,
  isRevoking,
  onSearch,
  onSelect,
  onRevokeSessions,
}: {
  readonly users: readonly AdminUserSearchItem[];
  readonly detail: AdminUserDetail | null;
  readonly loadState: LoadState | null;
  readonly isRevoking: boolean;
  readonly onSearch: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  readonly onSelect: (userId: string) => Promise<void>;
  readonly onRevokeSessions: (userId: string) => Promise<void>;
}) {
  return (
    <section className="panel" id="user-security">
      <div className="section-heading">
        <div>
          <p className="eyebrow">PEOPLE</p>
          <h2>User security administration</h2>
        </div>
        <span>{loadState === "ready" ? users.length : "—"}</span>
      </div>
      <p className="muted">
        Search safe Identity-owned account details and revoke active web sessions when needed.
      </p>
      <form className="admin-manager-form" onSubmit={(event) => void onSearch(event)}>
        <input
          name="query"
          placeholder="Search username, email, Telegram ID, or user id"
          minLength={2}
          required
        />
        <button type="submit">Search users</button>
      </form>
      {loadState === "loading" ? <p className="muted">Searching users…</p> : null}
      {loadState === "error" ? <p className="muted">User search is unavailable.</p> : null}
      {loadState === "ready" && !users.length ? <p className="muted">No users matched.</p> : null}
      <div className="admin-manager-list">
        {users.map((user) => (
          <article key={user.userId}>
            <strong>{user.displayName}</strong>
            <span>@{user.username}</span>
            <small>
              {user.activeSessionCount} active session{user.activeSessionCount === 1 ? "" : "s"}
              {user.telegramUsername ? ` · Telegram @${user.telegramUsername}` : ""}
            </small>
            <button type="button" onClick={() => void onSelect(user.userId)}>
              View user security
            </button>
          </article>
        ))}
      </div>
      {detail ? (
        <article className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">IDENTITY DETAIL</p>
              <h3>{detail.presentation.displayName}</h3>
            </div>
            <span>{detail.security.activeSessionCount} active</span>
          </div>
          <p className="muted">Web login: {detail.identity.web?.loginUsername ?? "—"}</p>
          <p className="muted">Telegram: {detail.identity.telegram?.telegramUsername ?? "—"}</p>
          <h4>Active sessions</h4>
          {detail.security.sessions.length ? (
            <ul>
              {detail.security.sessions.map((session) => (
                <li key={session.id}>
                  {session.isActive ? "Active" : "Inactive"} · last seen {session.lastSeenAt}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No web sessions recorded.</p>
          )}
          <button
            type="button"
            disabled={isRevoking || detail.security.activeSessionCount === 0}
            onClick={() => void onRevokeSessions(detail.userId)}
          >
            {isRevoking ? "Revoking active sessions…" : "Revoke active sessions"}
          </button>
        </article>
      ) : null}
    </section>
  );
}

export function AdminApp() {
  const { api, transport } = useHoomaFrontend();
  const adminApi = useMemo(() => createPlatformAdminApi(transport), [transport]);
  const [access, setAccess] = useState<{
    isPlatformOwner: boolean;
    managerCapabilities: readonly PlatformManagerCapability[];
  } | null>(null);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [communities, setCommunities] = useState<PublicCommunitySummary[]>([]);
  const [teams, setTeams] = useState<PublicTeamSummary[]>([]);
  const [managers, setManagers] = useState<AppManagerSummary[]>([]);
  const [audit, setAudit] = useState<PlatformAuditEntry[]>([]);
  const [auditFilters, setAuditFilters] = useState<AuditArchiveFilters>(EMPTY_AUDIT_FILTERS);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditLoadingMore, setAuditLoadingMore] = useState(false);
  const [adminIssues, setAdminIssues] = useState<AdminIssueSummary[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserSearchItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUserDetail | null>(null);
  const [userSearchState, setUserSearchState] = useState<LoadState | null>(null);
  const [userSessionsRevoking, setUserSessionsRevoking] = useState(false);
  const [queues, setQueues] = useState<AdminQueues>({
    places: [],
    "place-ownership": [],
    pitch: [],
  });
  const [accessState, setAccessState] = useState<LoadState>("loading");
  const [overviewState, setOverviewState] = useState<LoadState>("loading");
  const [auditState, setAuditState] = useState<LoadState>("loading");
  const [adminIssuesState, setAdminIssuesState] = useState<LoadState>("loading");
  const [managerState, setManagerState] = useState<LoadState>("loading");
  const [communitiesState, setCommunitiesState] = useState<LoadState>("loading");
  const [teamsState, setTeamsState] = useState<LoadState>("loading");
  const [queueStates, setQueueStates] = useState<AdminQueueStates>({
    places: "loading",
    "place-ownership": "loading",
    pitch: "loading",
  });
  const [gamerDisputeCount, setGamerDisputeCount] = useState<number | null>(null);
  const [gamerDisputeState, setGamerDisputeState] = useState<AttentionLoadState>("loading");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingDecision, setPendingDecision] = useState<{ queue: QueueName; id: string } | null>(
    null,
  );
  const [managerSaving, setManagerSaving] = useState(false);
  const decisionInFlight = useRef(false);
  const managerSaveInFlight = useRef(false);

  function can(capability: PlatformManagerCapability): boolean {
    return Boolean(access?.isPlatformOwner || access?.managerCapabilities.includes(capability));
  }

  async function loadModule(setState: (state: LoadState) => void, task: () => Promise<void>) {
    setState("loading");
    try {
      await task();
      setState("ready");
    } catch {
      setState("error");
    }
  }

  function setQueueState(queue: QueueName, state: LoadState) {
    setQueueStates((current) => ({ ...current, [queue]: state }));
  }

  async function loadQueue(queue: QueueName) {
    await loadModule(
      (state) => setQueueState(queue, state),
      async () => {
        if (queue === "places") {
          const rows = await adminApi.placeQueue();
          setQueues((current) => ({ ...current, places: rows }));
        } else if (queue === "place-ownership") {
          const rows = await adminApi.placeOwnershipQueue();
          setQueues((current) => ({ ...current, "place-ownership": rows }));
        } else {
          const rows = await adminApi.pitchQueue();
          setQueues((current) => ({ ...current, pitch: rows }));
        }
      },
    );
  }

  async function loadManagers() {
    await loadModule(setManagerState, async () => {
      setManagers(await adminApi.managers());
    });
  }

  async function loadOverview() {
    await loadModule(setOverviewState, async () => {
      setOverview(await adminApi.overview());
    });
  }

  async function loadAudit(filters: AuditArchiveFilters = auditFilters) {
    await loadModule(setAuditState, async () => {
      const page = await adminApi.audit({ ...filters, limit: 100 });
      setAudit([...page.items]);
      setAuditCursor(page.nextCursor);
    });
  }

  async function applyAuditFilters(filters: AuditArchiveFilters) {
    setAuditFilters(filters);
    setAudit([]);
    setAuditCursor(null);
    await loadAudit(filters);
  }

  async function retryAudit() {
    await loadAudit(auditFilters);
  }

  async function loadMoreAudit() {
    if (!auditCursor || auditLoadingMore) return;
    setAuditLoadingMore(true);
    setError("");
    try {
      const page = await adminApi.audit({ ...auditFilters, cursor: auditCursor, limit: 100 });
      setAudit((current) => [...current, ...page.items]);
      setAuditCursor(page.nextCursor);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load more audit entries");
    } finally {
      setAuditLoadingMore(false);
    }
  }

  async function loadAdminIssues() {
    await loadModule(setAdminIssuesState, async () => {
      setAdminIssues(await adminApi.issues());
    });
  }

  async function searchAdminUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = String(data.get("query") ?? "").trim();
    if (query.length < 2) return;
    setUserSearchState("loading");
    setError("");
    setMessage("");
    try {
      const rows = await adminApi.users(query);
      setAdminUsers(rows);
      setSelectedUser(null);
      setUserSearchState("ready");
    } catch (reason) {
      setUserSearchState("error");
      setError(reason instanceof Error ? reason.message : "Unable to search users");
    }
  }

  async function selectAdminUser(userId: string) {
    setError("");
    try {
      setSelectedUser(await adminApi.userDetail(userId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load user security detail");
    }
  }

  async function revokeAdminUserSessions(userId: string) {
    if (userSessionsRevoking) return;
    const note = window.prompt("Reason for revoking this user's active sessions")?.trim();
    if (!note) return;
    setUserSessionsRevoking(true);
    setError("");
    setMessage("");
    try {
      const result = await adminApi.revokeUserSessions(userId, { note });
      setMessage(`${result.revokedSessionCount} active user session(s) revoked and audited.`);
      setSelectedUser(await adminApi.userDetail(userId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to revoke user sessions");
    } finally {
      setUserSessionsRevoking(false);
    }
  }

  async function load() {
    setAccessState("loading");
    setError("");

    let currentAccess: {
      isPlatformOwner: boolean;
      managerCapabilities: readonly PlatformManagerCapability[];
    };
    try {
      currentAccess = await adminApi.access();
      setAccess(currentAccess);
      setAccessState("ready");
    } catch (reason) {
      setAccess(null);
      setAccessState("error");
      setError(reason instanceof Error ? reason.message : "Platform access check failed.");
      return;
    }

    if (!currentAccess.isPlatformOwner && currentAccess.managerCapabilities.length === 0) return;

    const tasks: Promise<void>[] = [];
    const allowed = (capability: PlatformManagerCapability) =>
      currentAccess.isPlatformOwner || currentAccess.managerCapabilities.includes(capability);

    if (allowed("VIEW_AUDIT")) {
      tasks.push(loadOverview(), loadAudit());
    }

    if (allowed("VIEW_AUDIT") || allowed("MANAGE_ADMIN_ISSUES")) {
      tasks.push(loadAdminIssues());
    }

    if (currentAccess.isPlatformOwner) {
      tasks.push(loadQueue("places"), loadQueue("place-ownership"));
    }

    if (allowed("REVIEW_PITCH_APPLICATIONS")) {
      tasks.push(loadQueue("pitch"));
    }

    if (currentAccess.isPlatformOwner) {
      tasks.push(
        loadManagers(),
        loadModule(setCommunitiesState, async () => {
          const page = await api.communities.publicList();
          setCommunities(page.items);
        }),
        loadModule(setTeamsState, async () => {
          const page = await api.teams.publicList({ limit: 100 });
          setTeams(page.items);
        }),
      );
    }

    await Promise.all(tasks);
  }

  useEffect(() => {
    void load();
  }, [api, adminApi]);

  async function decide(queue: QueueName, id: string, decision: "APPROVE" | "REJECT") {
    if (decisionInFlight.current) return;
    decisionInFlight.current = true;
    setPendingDecision({ queue, id });
    const note =
      window.prompt(`${decision === "APPROVE" ? "Approval" : "Rejection"} note (optional)`) ?? "";
    const input = { decision, note: note || null } as const;
    setError("");
    setMessage("");
    try {
      if (queue === "places") {
        await adminApi.decidePlace(id, input);
      } else if (queue === "place-ownership") {
        await adminApi.decidePlaceOwnership(id, input);
      } else {
        const row = queues.pitch.find((item) => item.id === id);
        if (!row) throw new Error("Pitch review item is no longer available");
        await adminApi.decidePitch(row.target, id, input);
      }
      setMessage("Decision saved and audited.");
      const refreshes = [loadQueue(queue)];
      if (can("VIEW_AUDIT")) refreshes.push(loadOverview(), loadAudit());
      if (can("VIEW_AUDIT") || can("MANAGE_ADMIN_ISSUES")) refreshes.push(loadAdminIssues());
      await Promise.all(refreshes);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save decision");
    } finally {
      decisionInFlight.current = false;
      setPendingDecision(null);
    }
  }

  async function appointManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (managerSaveInFlight.current) return;
    managerSaveInFlight.current = true;
    setManagerSaving(true);
    const form = event.currentTarget;
    const data = new FormData(form);
    const username = String(data.get("username") ?? "").trim();
    const capabilities = MANAGER_CAPABILITIES.filter((capability) => data.get(capability) === "on");
    setError("");
    setMessage("");
    try {
      await adminApi.setManager(username, capabilities);
      form.reset();
      setMessage(
        capabilities.length ? "App Manager permissions saved." : "App Manager permissions revoked.",
      );
      await Promise.all([loadManagers(), loadOverview(), loadAdminIssues(), loadAudit()]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update App Manager");
    } finally {
      managerSaveInFlight.current = false;
      setManagerSaving(false);
    }
  }

  if (!access) {
    return (
      <section className="auth-card">
        <p className="eyebrow">PLATFORM CONTROL ROOM</p>
        <h2>{accessState === "error" ? "Unable to verify access" : "Loading access"}</h2>
        <p className={accessState === "error" ? "error" : "muted"}>
          {accessState === "error"
            ? error || "Platform access check failed."
            : "Checking authority…"}
        </p>
      </section>
    );
  }

  if (!access.isPlatformOwner && access.managerCapabilities.length === 0) {
    return (
      <section className="auth-card">
        <p className="eyebrow">PLATFORM CONTROL ROOM</p>
        <h2>Access required</h2>
        <p className="muted">This account has no App Manager permissions.</p>
      </section>
    );
  }

  const canReviewPitch = can("REVIEW_PITCH_APPLICATIONS");
  const canViewAudit = can("VIEW_AUDIT");
  const canManageAdminIssues = can("MANAGE_ADMIN_ISSUES");
  const canManageUsers = can("MANAGE_USERS");
  const attentionItems: AttentionItem[] = [];
  if (access.isPlatformOwner) {
    attentionItems.push(
      {
        label: "Place reviews",
        count: queues.places.length,
        href: "#places",
        state: queueStates.places,
      },
      {
        label: "Ownership claims",
        count: queues["place-ownership"].length,
        href: "#place-ownership",
        state: queueStates["place-ownership"],
      },
    );
  }
  if (canReviewPitch) {
    attentionItems.push({
      label: "Pitch reviews",
      count: queues.pitch.length,
      href: "#pitch",
      state: queueStates.pitch,
    });
  }
  if (access.isPlatformOwner) {
    attentionItems.push({
      label: "Gamer disputes",
      count: gamerDisputeCount,
      href: "#gamers",
      state: gamerDisputeState,
    });
  }
  if (canManageAdminIssues) {
    attentionItems.push({
      label: "Admin issues",
      count: adminIssues.length,
      href: "#admin-action-inbox",
      state: adminIssuesState,
    });
  }

  return (
    <ControlRoomShell
      isPlatformOwner={access.isPlatformOwner}
      managerCapabilities={access.managerCapabilities}
      canReviewPitch={canReviewPitch}
      canViewAudit={canViewAudit}
      canManageAdminIssues={canManageAdminIssues}
      canManageUsers={canManageUsers}
      message={message}
      error={error}
    >
      <ControlRoomOverview
        overview={canViewAudit ? overview : null}
        overviewState={canViewAudit ? overviewState : null}
        attentionItems={attentionItems}
        adminIssues={canManageAdminIssues || canViewAudit ? adminIssues : []}
        adminIssuesState={canManageAdminIssues || canViewAudit ? adminIssuesState : null}
        recentAudit={audit.slice(0, 5)}
        auditState={canViewAudit ? auditState : null}
      />

      <ReviewQueues
        queues={queues}
        queueStates={queueStates}
        showPlaceQueues={access.isPlatformOwner}
        showPitchQueue={canReviewPitch}
        pendingDecision={pendingDecision}
        onDecision={(queue, id, decision) => void decide(queue, id, decision)}
      />

      {access.isPlatformOwner ? (
        <GamerDisputeConsole
          onCountChange={setGamerDisputeCount}
          onQueueStateChange={setGamerDisputeState}
          onResolved={async () => {
            if (can("VIEW_AUDIT")) await Promise.all([loadOverview(), loadAudit()]);
            if (can("VIEW_AUDIT") || can("MANAGE_ADMIN_ISSUES")) await loadAdminIssues();
          }}
        />
      ) : null}

      {canManageUsers ? (
        <AdminUsers
          users={adminUsers}
          detail={selectedUser}
          loadState={userSearchState}
          isRevoking={userSessionsRevoking}
          onSearch={searchAdminUsers}
          onSelect={selectAdminUser}
          onRevokeSessions={revokeAdminUserSessions}
        />
      ) : null}

      {access.isPlatformOwner ? (
        <AccessManagers
          managers={managers}
          loadState={managerState}
          isSaving={managerSaving}
          onSubmit={appointManager}
        />
      ) : null}

      {access.isPlatformOwner ? (
        <ManagedEntities
          communities={communities}
          teams={teams}
          communitiesState={communitiesState}
          teamsState={teamsState}
        />
      ) : null}

      {canViewAudit ? (
        <AuditArchive
          entries={audit}
          loadState={auditState}
          filters={auditFilters}
          hasMore={Boolean(auditCursor)}
          isLoadingMore={auditLoadingMore}
          onFilterChange={(filters) => void applyAuditFilters(filters)}
          onRetry={() => void retryAudit()}
          onLoadMore={() => void loadMoreAudit()}
        />
      ) : null}
    </ControlRoomShell>
  );
}
