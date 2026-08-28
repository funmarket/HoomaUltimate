import type { ModerationDecisionInput } from "@hooma/contracts/moderation";
import type {
  PlaceOwnershipReviewQueueItem,
  PlaceReviewQueueItem,
} from "@hooma/contracts/places";
import type { PitchReviewQueueItem, PitchReviewTarget } from "@hooma/contracts/pitch";
import type {
  AdminAccess,
  AppManagerSummary,
  PlatformManagerCapability,
} from "@hooma/contracts/platform-admin";
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

export function createPlatformAdminApi(transport: HoomaTransport) {
  return {
    access: () => request<AdminAccess>(transport, "/api/v1/admin/access"),
    overview: () => request<PlatformOverview>(transport, "/api/v1/admin/overview"),
    audit: () => request<PlatformAuditEntry[]>(transport, "/api/v1/admin/audit?limit=100"),
    managers: () => request<AppManagerSummary[]>(transport, "/api/v1/admin/managers"),
    setManager: (username: string, capabilities: readonly PlatformManagerCapability[]) =>
      request<{ ok: true }>(transport, `/api/v1/admin/managers/${encodeURIComponent(username)}`, {
        method: "PUT",
        body: JSON.stringify({ capabilities }),
      }),
    placeQueue: () => request<PlaceReviewQueueItem[]>(transport, "/api/v1/admin/queues/places"),
    placeOwnershipQueue: () =>
      request<PlaceOwnershipReviewQueueItem[]>(transport, "/api/v1/admin/queues/place-ownership"),
    pitchQueue: () => request<PitchReviewQueueItem[]>(transport, "/api/v1/admin/queues/pitch"),
    decidePlace: (placeId: string, input: ModerationDecisionInput) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/admin/queues/places/${encodeURIComponent(placeId)}/decision`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    decidePlaceOwnership: (claimId: string, input: ModerationDecisionInput) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/admin/queues/place-ownership/${encodeURIComponent(claimId)}/decision`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    decidePitch: (
      target: PitchReviewTarget,
      reviewId: string,
      input: ModerationDecisionInput,
    ) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/admin/queues/pitch/${encodeURIComponent(target)}/${encodeURIComponent(reviewId)}/decision`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  };
}
