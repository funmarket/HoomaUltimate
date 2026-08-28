import type {
  AdminAccess,
  AdminQueueItem,
  AppManagerSummary,
  ManagedPlaceSummary,
  ModerationDecisionInput,
  PitchManagementState,
  PlaceCapabilityApplicationInput,
  PlaceCapabilityKind,
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
  PlaceSuggestionResult,
  PlaceUpdateInput,
  PlatformManagerCapability,
  PublicPlaceCapability,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import type {
  GamerDisputeList,
  GamerDisputeResolutionInput,
  GamerMatchSession,
  GamerMatchSide,
} from "@hooma/contracts/gamers";
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
      get: (placeId: string) =>
        request<PublicPlaceSummary>(
          transport,
          `/api/public/v1/places/${encodeURIComponent(placeId)}`,
        ),
      manage: (placeId: string) =>
        request<ManagedPlaceSummary>(
          transport,
          `/api/v1/places/${encodeURIComponent(placeId)}/manage`,
        ),
      ownershipStatus: (placeId: string) =>
        request<{ verified: boolean }>(
          transport,
          `/api/v1/places/${encodeURIComponent(placeId)}/ownership-status`,
        ),
      suggest: (input: PlaceSuggestionInput) =>
        request<PlaceSuggestionResult>(transport, "/api/v1/places", {
          method: "POST",
          body: JSON.stringify(input),
        }),
      update: (placeId: string, input: PlaceUpdateInput) =>
        request<ManagedPlaceSummary>(transport, `/api/v1/places/${encodeURIComponent(placeId)}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        }),
      archive: (placeId: string) =>
        request<{ ok: true }>(transport, `/api/v1/places/${encodeURIComponent(placeId)}`, {
          method: "DELETE",
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
      get: (kind: PlaceCapabilityKind, placeId: string) =>
        request<PublicPlaceCapability>(
          transport,
          `/api/public/v1/${kind.toLowerCase()}/${encodeURIComponent(placeId)}`,
        ),
      manage: (kind: PlaceCapabilityKind, placeId: string) =>
        request<PitchManagementState>(
          transport,
          `/api/v1/${kind.toLowerCase()}/${encodeURIComponent(placeId)}/manage`,
        ),
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
      gamerDisputes: () =>
        request<GamerDisputeList>(transport, "/api/v1/admin/queues/gamer-disputes"),
      resolveGamerDispute: (matchId: string, input: GamerDisputeResolutionInput) =>
        request<GamerMatchSession>(
          transport,
          `/api/v1/admin/queues/gamer-disputes/${encodeURIComponent(matchId)}/resolve`,
          { method: "POST", body: JSON.stringify(input) },
        ),
      gamerDisputeProof: async (matchId: string, side: GamerMatchSide): Promise<Blob> => {
        const headers = transport.getHeaders?.();
        const response = await fetch(
          `${transport.baseUrl}/api/v1/admin/queues/gamer-disputes/${encodeURIComponent(matchId)}/proof/${side.toLowerCase()}`,
          {
            ...(transport.credentials ? { credentials: transport.credentials } : {}),
            ...(headers ? { headers } : {}),
          },
        );
        if (!response.ok) throw new Error(`Unable to load match proof (${response.status})`);
        return response.blob();
      },
    },
  };
}
