import { z } from "zod";
import type { PublicPlaceSummary } from "./places.js";
import type { PitchRentalCurrency } from "./pitch.js";

export const platformManagerCapabilitySchema = z.enum(["REVIEW_PITCH_APPLICATIONS", "VIEW_AUDIT"]);

export const moderationDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const appManagerUpdateSchema = z.object({
  capabilities: z.array(platformManagerCapabilitySchema).max(2),
});

export type PlatformManagerCapability = z.infer<typeof platformManagerCapabilitySchema>;
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
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
  readonly target: "INITIAL_SUGGESTION" | "OWNER_REVISION";
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
