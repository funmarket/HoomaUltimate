import { z } from "zod";
import type { ModerationStatus, PublicPlaceSummary } from "./places.js";
import type { PlaceCapabilityKind, PitchRentalCurrency } from "./pitch.js";

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

export interface AdminAccess {
  readonly isPlatformOwner: boolean;
  readonly managerCapabilities: readonly PlatformManagerCapability[];
}

export interface AdminQueueItem {
  readonly id: string;
  readonly status: ModerationStatus;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly applicant: {
    readonly userId: string;
    readonly username: string;
    readonly displayName: string;
  };
  readonly place: PublicPlaceSummary;
  readonly kind?: PlaceCapabilityKind;
  readonly summary?: string;
  readonly hourlyRateMinor?: number | null;
  readonly currency?: PitchRentalCurrency | null;
  readonly evidence?: string;
}

export interface AppManagerSummary {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly capabilities: readonly PlatformManagerCapability[];
}
