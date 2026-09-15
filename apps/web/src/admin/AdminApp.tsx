import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AppManagerSummary, PlatformManagerCapability } from "@hooma/contracts/platform-admin";
import {
  createPlatformAdminApi,
  useHoomaFrontend,
  type PlatformAuditEntry,
  type PlatformOverview,
  type PublicCommunitySummary,
  type PublicTeamSummary,
} from "@hooma/frontend";
import { AccessManagers, MANAGER_CAPABILITIES } from "./AccessManagers";
import { AuditArchive } from "./AuditArchive";
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
  const [queues, setQueues] = useState<AdminQueues>({
    places: [],
    "place-ownership": [],
    pitch: [],
  });
  const [accessState, setAccessState] = useState<LoadState>("loading");
  const [overviewState, setOverviewState] = useState<LoadState>("loading");
  const [auditState, setAuditState] = useState<LoadState>("loading");
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
      tasks.push(
        loadModule(setOverviewState, async () => {
          setOverview(await adminApi.overview());
        }),
        loadModule(setAuditState, async () => {
          setAudit(await adminApi.audit());
        }),
      );
    }

    if (currentAccess.isPlatformOwner) {
      tasks.push(
        loadModule(
          (state) =>
            setQueueStates((current) => ({
              ...current,
              places: state,
            })),
          async () => {
            const rows = await adminApi.placeQueue();
            setQueues((current) => ({ ...current, places: rows }));
          },
        ),
        loadModule(
          (state) =>
            setQueueStates((current) => ({
              ...current,
              "place-ownership": state,
            })),
          async () => {
            const rows = await adminApi.placeOwnershipQueue();
            setQueues((current) => ({ ...current, "place-ownership": rows }));
          },
        ),
      );
    }

    if (allowed("REVIEW_PITCH_APPLICATIONS")) {
      tasks.push(
        loadModule(
          (state) =>
            setQueueStates((current) => ({
              ...current,
              pitch: state,
            })),
          async () => {
            const rows = await adminApi.pitchQueue();
            setQueues((current) => ({ ...current, pitch: rows }));
          },
        ),
      );
    }

    if (currentAccess.isPlatformOwner) {
      tasks.push(
        loadModule(setManagerState, async () => {
          setManagers(await adminApi.managers());
        }),
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
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save decision");
    }
  }

  async function appointManager(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to update App Manager");
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

  return (
    <ControlRoomShell
      isPlatformOwner={access.isPlatformOwner}
      managerCapabilities={access.managerCapabilities}
      canReviewPitch={canReviewPitch}
      canViewAudit={canViewAudit}
      message={message}
      error={error}
    >
      <ControlRoomOverview
        overview={canViewAudit ? overview : null}
        overviewState={canViewAudit ? overviewState : null}
        attentionItems={attentionItems}
        recentAudit={audit.slice(0, 5)}
        auditState={canViewAudit ? auditState : null}
      />

      <ReviewQueues
        queues={queues}
        queueStates={queueStates}
        showPlaceQueues={access.isPlatformOwner}
        showPitchQueue={canReviewPitch}
        onDecision={(queue, id, decision) => void decide(queue, id, decision)}
      />

      {access.isPlatformOwner ? (
        <GamerDisputeConsole
          onCountChange={setGamerDisputeCount}
          onQueueStateChange={setGamerDisputeState}
        />
      ) : null}

      {access.isPlatformOwner ? (
        <AccessManagers managers={managers} loadState={managerState} onSubmit={appointManager} />
      ) : null}

      {access.isPlatformOwner ? (
        <ManagedEntities
          communities={communities}
          teams={teams}
          communitiesState={communitiesState}
          teamsState={teamsState}
        />
      ) : null}

      {canViewAudit ? <AuditArchive entries={audit} loadState={auditState} /> : null}
    </ControlRoomShell>
  );
}
