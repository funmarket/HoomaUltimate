import type {
  AdminAccess,
  AdminQueueItem,
  AppManagerSummary,
  ModerationDecisionInput,
  PlaceCapabilityApplicationInput,
  PlaceCapabilityKind,
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
  PlatformManagerCapability,
  PublicPlaceCapability,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { request, type HoomaTransport } from "../http";

export interface PlatformOverview {
  readonly users: number;
  readonly activePlatformAdmins: number;
  readonly activeAppManagers: number;
  readonly auditEntries: number;
}

export interface PlatformAuditEntry {
  readonly id: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly createdAt: string;
}

export function createPlatformManagementApi(transport: HoomaTransport) {
  return {
    places: {
      list: () => request<PublicPlaceSummary[]>(transport, "/api/public/v1/places"),
      suggest: (input: PlaceSuggestionInput) =>
        request<PublicPlaceSummary & { status: string }>(transport, "/api/v1/places", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      claimOwnership: (placeId: string, input: PlaceOwnershipClaimInput) =>
        request<{ id: string; status: string }>(
          transport,
          `/api/v1/places/${encodeURIComponent(placeId)}/ownership-claims`,
          { method: "POST", body: JSON.stringify(input) },
        ),
    },
    capability: {
      list: (kind: PlaceCapabilityKind) =>
        request<PublicPlaceCapability[]>(transport, `/api/public/v1/${kind.toLowerCase()}`),
      submit: (
        kind: PlaceCapabilityKind,
        placeId: string,
        input: PlaceCapabilityApplicationInput,
      ) =>
        request<{ id: string; status: string }>(
          transport,
          `/api/v1/${kind.toLowerCase()}/applications`,
          {
            method: "POST",
            body: JSON.stringify({ placeId, ...input }),
          },
        ),
    },
    admin: {
      access: () => request<AdminAccess>(transport, "/api/v1/admin/access"),
      overview: () => request<PlatformOverview>(transport, "/api/v1/admin/overview"),
      audit: () => request<PlatformAuditEntry[]>(transport, "/api/v1/admin/audit?limit=100"),
      managers: () => request<AppManagerSummary[]>(transport, "/api/v1/admin/managers"),
      setManager: (username: string, capabilities: readonly PlatformManagerCapability[]) =>
        request<{ ok: true }>(transport, `/api/v1/admin/managers/${encodeURIComponent(username)}`, {
          method: "PUT",
          body: JSON.stringify({ capabilities }),
        }),
      queue: (name: "places" | "place-ownership" | "pitch") =>
        request<AdminQueueItem[]>(transport, `/api/v1/admin/queues/${name}`),
      decide: (
        name: "places" | "place-ownership" | "pitch",
        id: string,
        input: ModerationDecisionInput,
      ) =>
        request<{ ok: true }>(
          transport,
          `/api/v1/admin/queues/${name}/${encodeURIComponent(id)}/decision`,
          { method: "POST", body: JSON.stringify(input) },
        ),
    },
  };
}
