import { z } from "zod";

export const platformManagerCapabilitySchema = z.enum([
  "REVIEW_PLACES",
  "REVIEW_PLACE_OWNERSHIP",
  "REVIEW_PITCH_APPLICATIONS",
  "VIEW_AUDIT",
]);

export const moderationStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const placeCapabilityKindSchema = z.literal("PITCH");

export const placeSuggestionSchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().max(100).optional().nullable(),
  houma: z.string().trim().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  websiteUrl: z.string().trim().url().max(2000).optional().nullable(),
  imageUrl: z.string().trim().url().max(4000).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().max(320).optional().nullable(),
});

export const placeOwnershipClaimSchema = z.object({
  evidence: z.string().trim().min(10).max(4000),
});

export const placeCapabilityApplicationSchema = z.object({
  summary: z.string().trim().min(10).max(1500),
  contactName: z.string().trim().min(2).max(120),
  contactPhone: z.string().trim().max(60).optional().nullable(),
  contactEmail: z.string().trim().email().max(320).optional().nullable(),
});

export const moderationDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const appManagerUpdateSchema = z.object({
  capabilities: z.array(platformManagerCapabilitySchema).max(4),
});

export type PlatformManagerCapability = z.infer<typeof platformManagerCapabilitySchema>;
export type ModerationStatus = z.infer<typeof moderationStatusSchema>;
export type PlaceCapabilityKind = z.infer<typeof placeCapabilityKindSchema>;
export type PlaceSuggestionInput = z.infer<typeof placeSuggestionSchema>;
export type PlaceOwnershipClaimInput = z.infer<typeof placeOwnershipClaimSchema>;
export type PlaceCapabilityApplicationInput = z.infer<typeof placeCapabilityApplicationSchema>;
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
export type AppManagerUpdateInput = z.infer<typeof appManagerUpdateSchema>;

export interface PublicPlaceSummary {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly address: string;
  readonly city: string | null;
  readonly houma: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly phone: string | null;
  readonly websiteUrl: string | null;
  readonly imageUrl: string | null;
  readonly description: string | null;
  readonly category: string | null;
  readonly email: string | null;
}

export interface PublicPlaceCapability {
  readonly id: string;
  readonly kind: PlaceCapabilityKind;
  readonly summary: string;
  readonly place: PublicPlaceSummary;
}

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
  readonly evidence?: string;
}

export interface AppManagerSummary {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly capabilities: readonly PlatformManagerCapability[];
}
