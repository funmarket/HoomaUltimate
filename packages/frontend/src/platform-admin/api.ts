import type {
  AdminAccess,
  AdminAuditQueryInput,
  AdminIssueStatusUpdateInput,
  AdminIssueSummary,
  AdminUserModerationStatus,
  AdminUserSanctionClearInput,
  AdminUserSanctionInput,
  AdminPitchReviewQueueItem,
  AdminPlaceOwnershipReviewQueueItem,
  AdminPlaceReviewQueueItem,
  AdminUserDetail,
  AdminUserSearchItem,
  AppManagerSummary,
  ModerationDecisionInput,
  PlatformManagerCapability,
  PlatformAuditPage,
  UserSessionRevocationInput,
} from "@hooma/contracts/platform-admin";
import { request, requestBinary, type HoomaTransport } from "../http";
import type { PageBannerDestination, PageBannerPlacementId } from "@hooma/contracts/page-banner";

export interface PageBannerAdminVariant {
  readonly variant: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface PageBannerAdminSlide {
  readonly id: string;
  readonly placementId: PageBannerPlacementId;
  readonly mediaId: string;
  readonly sortOrder: number;
  readonly enabled: boolean;
  readonly isDecorative: boolean;
  readonly altText: string | null;
  readonly destinationKind: "INTERNAL" | "EXTERNAL" | null;
  readonly destinationUrl: string | null;
  readonly variants: readonly PageBannerAdminVariant[];
}

export interface PageBannerAdminPlacement {
  readonly id: PageBannerPlacementId;
  readonly enabled: boolean;
  readonly slides: readonly PageBannerAdminSlide[];
}

export interface PageBannerSlideMetadataInput {
  readonly enabled?: boolean;
  readonly isDecorative: boolean;
  readonly altText: string | null;
  readonly destination: PageBannerDestination | null;
}

function pageBannerUploadQuery(input: PageBannerSlideMetadataInput): string {
  const params = new URLSearchParams({
    enabled: String(input.enabled ?? true),
    isDecorative: String(input.isDecorative),
  });
  if (input.altText !== null) params.set("altText", input.altText);
  if (input.destination) {
    params.set("destinationKind", input.destination.kind);
    params.set("destinationUrl", input.destination.url);
  }
  return params.toString();
}

export type {
  AdminIssueSummary,
  AdminUserDetail,
  AdminUserModerationStatus,
  AdminUserSanctionEvent,
  AdminUserSearchItem,
  PlatformAuditEntry,
  PlatformAuditPage,
} from "@hooma/contracts/platform-admin";

export interface PlatformOverview {
  readonly users: number;
  readonly activePlatformAdmins: number;
  readonly activeAppManagers: number;
  readonly auditEntries: number;
}

function auditQueryString(input: AdminAuditQueryInput = {}): string {
  const params = new URLSearchParams();
  params.set("limit", String(input.limit ?? 100));
  if (input.actor) params.set("actor", input.actor);
  if (input.action) params.set("action", input.action);
  if (input.entityType) params.set("entityType", input.entityType);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.cursor) params.set("cursor", input.cursor);
  return params.toString();
}

export function createPlatformAdminApi(transport: HoomaTransport) {
  const api = {
    access: () => request<AdminAccess>(transport, "/api/v1/admin/access"),
    overview: () => request<PlatformOverview>(transport, "/api/v1/admin/overview"),
    audit: (input: AdminAuditQueryInput = {}) =>
      request<PlatformAuditPage>(transport, `/api/v1/admin/audit?${auditQueryString(input)}`),
    issues: () => request<AdminIssueSummary[]>(transport, "/api/v1/admin/issues?limit=25"),
    resolveIssue: (issueId: string, input: AdminIssueStatusUpdateInput) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/admin/issues/${encodeURIComponent(issueId)}/resolve`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    dismissIssue: (issueId: string, input: AdminIssueStatusUpdateInput) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/admin/issues/${encodeURIComponent(issueId)}/dismiss`,
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    managers: () => request<AppManagerSummary[]>(transport, "/api/v1/admin/managers"),
    users: (query: string) =>
      request<AdminUserSearchItem[]>(
        transport,
        `/api/v1/admin/users?query=${encodeURIComponent(query)}&limit=25`,
      ),
    userDetail: (userId: string) =>
      request<AdminUserDetail>(transport, `/api/v1/admin/users/${encodeURIComponent(userId)}`),
    revokeUserSessions: (userId: string, input: UserSessionRevocationInput) =>
      request<{ ok: true; revokedSessionCount: number }>(
        transport,
        `/api/v1/admin/users/${encodeURIComponent(userId)}/sessions/revoke`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    sanctionUser: (userId: string, input: AdminUserSanctionInput) =>
      request<{ ok: true; moderation: AdminUserModerationStatus }>(
        transport,
        `/api/v1/admin/users/${encodeURIComponent(userId)}/sanctions`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    clearUserSanction: (userId: string, sanctionId: string, input: AdminUserSanctionClearInput) =>
      request<{ ok: true; moderation: AdminUserModerationStatus }>(
        transport,
        `/api/v1/admin/users/${encodeURIComponent(userId)}/sanctions/${encodeURIComponent(sanctionId)}/clear`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    setManager: (username: string, capabilities: readonly PlatformManagerCapability[]) =>
      request<{ ok: true }>(transport, `/api/v1/admin/managers/${encodeURIComponent(username)}`, {
        method: "PUT",
        body: JSON.stringify({ capabilities }),
      }),
    placeQueue: () =>
      request<AdminPlaceReviewQueueItem[]>(transport, "/api/v1/admin/queues/places"),
    placeOwnershipQueue: () =>
      request<AdminPlaceOwnershipReviewQueueItem[]>(
        transport,
        "/api/v1/admin/queues/place-ownership",
      ),
    pitchQueue: () => request<AdminPitchReviewQueueItem[]>(transport, "/api/v1/admin/queues/pitch"),
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
      target: AdminPitchReviewQueueItem["target"],
      reviewId: string,
      input: ModerationDecisionInput,
    ) =>
      request<{ ok: true }>(
        transport,
        `/api/v1/admin/queues/pitch/${encodeURIComponent(target)}/${encodeURIComponent(reviewId)}/decision`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    pageBanners: {
      list: () => request<PageBannerAdminPlacement[]>(transport, "/api/v1/admin/banners"),
      setEnabled: (placementId: PageBannerPlacementId, enabled: boolean) =>
        request<PageBannerAdminPlacement>(
          transport,
          `/api/v1/admin/banners/${encodeURIComponent(placementId)}`,
          { method: "PATCH", body: JSON.stringify({ enabled }) },
        ),
      upload: (
        placementId: PageBannerPlacementId,
        file: Blob,
        input: PageBannerSlideMetadataInput,
        slideId?: string,
      ) =>
        requestBinary<PageBannerAdminSlide>(
          transport,
          `/api/v1/admin/banners/${encodeURIComponent(placementId)}/slides${slideId ? `/${encodeURIComponent(slideId)}` : ""}/upload?${pageBannerUploadQuery(input)}`,
          file,
          file.type,
          { method: "POST" },
        ),
      updateSlide: (
        placementId: PageBannerPlacementId,
        slideId: string,
        input: PageBannerSlideMetadataInput,
      ) =>
        request<PageBannerAdminSlide>(
          transport,
          `/api/v1/admin/banners/${encodeURIComponent(placementId)}/slides/${encodeURIComponent(slideId)}`,
          { method: "PATCH", body: JSON.stringify(input) },
        ),
      reorder: (placementId: PageBannerPlacementId, slideIds: readonly string[]) =>
        request<PageBannerAdminSlide[]>(
          transport,
          `/api/v1/admin/banners/${encodeURIComponent(placementId)}/slides/reorder`,
          { method: "POST", body: JSON.stringify({ slideIds }) },
        ),
      deleteSlide: (placementId: PageBannerPlacementId, slideId: string) =>
        request<{ ok: true }>(
          transport,
          `/api/v1/admin/banners/${encodeURIComponent(placementId)}/slides/${encodeURIComponent(slideId)}`,
          { method: "DELETE" },
        ),
    },
  };
  return api;
}

export type PlatformAdminApi = ReturnType<typeof createPlatformAdminApi>;
