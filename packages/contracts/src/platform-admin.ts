import { z } from "zod";
import type { PublicPlaceSummary } from "./places.js";
import type { PitchRentalCurrency } from "./pitch.js";

export const platformManagerCapabilitySchema = z.enum([
  "REVIEW_PITCH_APPLICATIONS",
  "VIEW_AUDIT",
  "MANAGE_ADMIN_ISSUES",
  "MANAGE_USERS",
]);
export const adminIssueSeveritySchema = z.enum(["INFO", "WARNING", "CRITICAL"]);
export const adminIssueStatusUpdateSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});
export const adminUserSearchQuerySchema = z.object({
  query: z.string().trim().max(120).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(25),
});
export const adminAuditQuerySchema = z.object({
  actor: z.string().trim().min(1).max(120).optional(),
  action: z.string().trim().min(1).max(120).optional(),
  entityType: z.string().trim().min(1).max(120).optional(),
  from: z.string().trim().min(1).max(40).optional(),
  to: z.string().trim().min(1).max(40).optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(100),
});
export const userSessionRevocationSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});

export const adminUserSanctionActionSchema = z.enum([
  "YELLOW_CARD_WARNING",
  "TEMPORARY_BAN",
  "READ_ONLY",
  "ACCOUNT_DISABLED",
]);

export const adminUserSanctionInputSchema = z.object({
  actionType: adminUserSanctionActionSchema,
  reason: z.string().trim().min(1).max(1000),
  expiresAt: z.string().trim().datetime().optional().nullable(),
});

export const adminUserSanctionClearInputSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const moderationDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const adminPitchReviewTargetSchema = z.enum(["INITIAL_SUGGESTION", "OWNER_REVISION"]);

export const appManagerUpdateSchema = z.object({
  capabilities: z.array(platformManagerCapabilitySchema).max(4),
});

export type PlatformManagerCapability = z.infer<typeof platformManagerCapabilitySchema>;
export type AdminIssueSeverity = z.infer<typeof adminIssueSeveritySchema>;
export type AdminIssueStatusUpdateInput = z.infer<typeof adminIssueStatusUpdateSchema>;
export type AdminUserSearchQueryInput = z.infer<typeof adminUserSearchQuerySchema>;
export interface AdminAuditQueryInput {
  readonly actor?: string | undefined;
  readonly action?: string | undefined;
  readonly entityType?: string | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}
export type UserSessionRevocationInput = z.infer<typeof userSessionRevocationSchema>;
export type AdminUserSanctionActionInput = z.infer<typeof adminUserSanctionActionSchema>;
export type AdminUserSanctionInput = z.infer<typeof adminUserSanctionInputSchema>;
export type AdminUserSanctionClearInput = z.infer<typeof adminUserSanctionClearInputSchema>;
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
export type AdminPitchReviewTarget = z.infer<typeof adminPitchReviewTargetSchema>;
export type AppManagerUpdateInput = z.infer<typeof appManagerUpdateSchema>;
export type AdminModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdminAccess {
  readonly isPlatformOwner: boolean;
  readonly managerCapabilities: readonly PlatformManagerCapability[];
}

export interface AdminQueueApplicant {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
}

export interface AdminPlaceReviewQueueItem {
  readonly id: string;
  readonly status: AdminModerationStatus;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly applicant: AdminQueueApplicant;
  readonly place: PublicPlaceSummary;
}

export interface AdminPlaceOwnershipReviewQueueItem extends AdminPlaceReviewQueueItem {
  readonly evidence: string;
}

export interface AdminPitchReviewQueueItem {
  readonly id: string;
  readonly target: AdminPitchReviewTarget;
  readonly status: AdminModerationStatus;
  readonly summary: string;
  readonly hourlyRateMinor: number | null;
  readonly currency: PitchRentalCurrency | null;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly applicant: AdminQueueApplicant;
  readonly place: PublicPlaceSummary;
}

export interface AppManagerSummary {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly capabilities: readonly PlatformManagerCapability[];
}

export interface AdminIssueSummary {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly severity: AdminIssueSeverity;
  readonly source: "OUTBOX";
  readonly occurrenceCount: number;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PlatformAuditEntry {
  readonly id: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly createdAt: string;
}

export interface PlatformAuditPage {
  readonly items: readonly PlatformAuditEntry[];
  readonly nextCursor: string | null;
}

export interface AdminUserSearchItem {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly photoUrl: string | null;
  readonly telegramUsername: string | null;
  readonly hasWebCredential: boolean;
  readonly lastLoginAt: string | null;
  readonly activeSessionCount: number;
  readonly isPlatformAdmin: boolean;
  readonly managerCapabilities: readonly PlatformManagerCapability[];
}

export interface AdminUserSessionSummary {
  readonly id: string;
  readonly createdAt: string;
  readonly lastSeenAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly isActive: boolean;
}

export type AdminUserSanctionType =
  "YELLOW_CARD_WARNING" | "RED_CARD_BAN" | "TEMPORARY_BAN" | "READ_ONLY" | "ACCOUNT_DISABLED";

export interface AdminUserSanctionEvent {
  readonly id: string;
  readonly actionType: AdminUserSanctionType;
  readonly reason: string;
  readonly createdAt: string;
  readonly expiresAt: string | null;
  readonly clearedAt: string | null;
  readonly actorUserId: string;
}

export interface AdminUserModerationStatus {
  readonly yellowCardCount: number;
  readonly isBanned: boolean;
  readonly banExpiresAt: string | null;
  readonly isReadOnly: boolean;
  readonly readOnlyExpiresAt: string | null;
  readonly isDisabled: boolean;
  readonly activeSanctions: readonly AdminUserSanctionEvent[];
  readonly history: readonly AdminUserSanctionEvent[];
}

export interface AdminUserDetail {
  readonly userId: string;
  readonly presentation: {
    readonly username: string;
    readonly displayName: string;
    readonly photoUrl: string | null;
  };
  readonly identity: {
    readonly web: {
      readonly loginUsername: string;
      readonly email: string | null;
      readonly lastLoginAt: string | null;
    } | null;
    readonly telegram: {
      readonly telegramUserId: string;
      readonly telegramUsername: string | null;
      readonly lastAuthenticatedAt: string;
    } | null;
  };
  readonly access: {
    readonly isPlatformAdmin: boolean;
    readonly managerCapabilities: readonly PlatformManagerCapability[];
  };
  readonly security: {
    readonly activeSessionCount: number;
    readonly sessions: readonly AdminUserSessionSummary[];
  };
  readonly moderation: AdminUserModerationStatus;
}
