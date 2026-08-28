import { z } from "zod";

export const platformManagerCapabilitySchema = z.enum(["REVIEW_PITCH_APPLICATIONS", "VIEW_AUDIT"]);

export const moderationStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);
export const placeCapabilityKindSchema = z.literal("PITCH");
export const placeSubmissionOriginSchema = z.enum(["OWNER", "FANHUB"]);
export const pitchRentalCurrencySchema = z.enum(["TND", "EUR", "USD"]);

export const placeMenuItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.number().min(0).max(1_000_000),
  currency: z.string().trim().length(3).default("TND"),
});

export const placeImageUrlSchema = z.string().trim().url().max(4000);

export const pitchSuggestionSchema = z.object({
  hourlyRateMinor: z.number().int().min(0).max(100_000_000),
  currency: pitchRentalCurrencySchema,
});

const placeSuggestionBaseSchema = z.object({
  name: z.string().trim().min(2).max(160),
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().max(100).optional().nullable(),
  houma: z.string().trim().max(100).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  phone: z.string().trim().max(60).optional().nullable(),
  websiteUrl: z.string().trim().url().max(2000).optional().nullable(),
  imageUrl: placeImageUrlSchema.optional().nullable(),
  imageUrls: z.array(placeImageUrlSchema).max(4).optional().default([]),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().max(320).optional().nullable(),
  menuItems: z.array(placeMenuItemSchema).max(20).optional().default([]),
});

export const placeSuggestionSchema = placeSuggestionBaseSchema
  .extend({
    submissionOrigin: placeSubmissionOriginSchema.default("FANHUB"),
    suggestedCapabilities: z.array(placeCapabilityKindSchema).max(1).optional(),
    pitch: pitchSuggestionSchema.optional(),
  })
  .superRefine((input, context) => {
    const suggestsPitch = input.suggestedCapabilities?.includes("PITCH") ?? false;
    if (suggestsPitch && !input.pitch) {
      context.addIssue({
        code: "custom",
        path: ["pitch"],
        message: "Pitch hourly rental price and currency are required",
      });
    }
    if (!suggestsPitch && input.pitch) {
      context.addIssue({
        code: "custom",
        path: ["pitch"],
        message: "Pitch pricing is only valid for a Pitch suggestion",
      });
    }
  });

export const placeUpdateSchema = placeSuggestionBaseSchema
  .omit({ imageUrl: true, imageUrls: true, menuItems: true })
  .partial()
  .extend({
    imageUrl: placeImageUrlSchema.optional().nullable(),
    imageUrls: z.array(placeImageUrlSchema).max(4).optional(),
    menuItems: z.array(placeMenuItemSchema).max(20).optional(),
  });

export const placeOwnershipClaimSchema = z.object({
  evidence: z.string().trim().min(10).max(4000),
});

export const placeCapabilityApplicationSchema = z.object({
  summary: z.string().trim().min(10).max(1500),
  hourlyRateMinor: z.number().int().min(0).max(100_000_000),
  currency: pitchRentalCurrencySchema,
});

export const moderationDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

export const appManagerUpdateSchema = z.object({
  capabilities: z.array(platformManagerCapabilitySchema).max(2),
});

export type PlatformManagerCapability = z.infer<typeof platformManagerCapabilitySchema>;
export type ModerationStatus = z.infer<typeof moderationStatusSchema>;
export type PlaceCapabilityKind = z.infer<typeof placeCapabilityKindSchema>;
export type PlaceSubmissionOrigin = z.infer<typeof placeSubmissionOriginSchema>;
export type PitchRentalCurrency = z.infer<typeof pitchRentalCurrencySchema>;
export type PlaceMenuItemInput = z.infer<typeof placeMenuItemSchema>;
export type PitchSuggestionInput = z.infer<typeof pitchSuggestionSchema>;
export type PlaceSuggestionInput = z.infer<typeof placeSuggestionSchema>;
export type PlaceUpdateInput = z.infer<typeof placeUpdateSchema>;
export type PlaceOwnershipClaimInput = z.infer<typeof placeOwnershipClaimSchema>;
export type PlaceCapabilityApplicationInput = z.infer<typeof placeCapabilityApplicationSchema>;
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
export type AppManagerUpdateInput = z.infer<typeof appManagerUpdateSchema>;

export interface PublicPlaceMenuItem {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly currency: string;
}

export interface PublicPlaceImage {
  readonly id: string;
  readonly imageUrl: string;
  readonly sortOrder: number;
}

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
  readonly images: readonly PublicPlaceImage[];
  readonly description: string | null;
  readonly category: string | null;
  readonly email: string | null;
  readonly menuItems: readonly PublicPlaceMenuItem[];
  readonly submissionOrigin: PlaceSubmissionOrigin;
}

export interface ManagedPlaceSummary extends PublicPlaceSummary {
  readonly moderationStatus: ModerationStatus;
  readonly archivedAt: string | null;
}

export interface PublicPlaceCapability {
  readonly id: string;
  readonly kind: PlaceCapabilityKind;
  readonly summary: string | null;
  readonly hourlyRateMinor: number;
  readonly currency: PitchRentalCurrency;
  readonly place: PublicPlaceSummary;
}

export interface ManagedPitchApprovedState {
  readonly id: string;
  readonly summary: string | null;
  readonly hourlyRateMinor: number;
  readonly currency: PitchRentalCurrency;
  readonly approvedAt: string | null;
}

export interface ManagedPitchPendingApplication {
  readonly id: string;
  readonly summary: string;
  readonly hourlyRateMinor: number | null;
  readonly currency: PitchRentalCurrency | null;
  readonly submittedAt: string;
}

export interface ManagedPitchRejectedApplication {
  readonly id: string;
  readonly summary: string;
  readonly hourlyRateMinor: number | null;
  readonly currency: PitchRentalCurrency | null;
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface PitchCapabilityManagementState {
  readonly approvedPitch: ManagedPitchApprovedState | null;
  readonly pendingApplication: ManagedPitchPendingApplication | null;
  readonly latestRejectedApplication: ManagedPitchRejectedApplication | null;
}

export interface PitchManagementState extends PitchCapabilityManagementState {
  readonly place: PublicPlaceSummary;
  readonly verifiedOwnership: boolean;
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
