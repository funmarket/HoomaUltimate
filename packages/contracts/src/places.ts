import { z } from "zod";

export const placeSubmissionOriginSchema = z.enum(["OWNER", "FANHUB"]);

export const placeMenuItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  price: z.number().min(0).max(1_000_000),
  currency: z.string().trim().length(3).default("TND"),
});

export const PLACE_OWNER_IMAGE_LIMIT = 3;
export const PLACE_APP_ADMIN_IMAGE_LIMIT = 6;
export const PLACE_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PLACE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const placeImageUrlSchema = z
  .string()
  .trim()
  .url()
  .max(4000)
  .superRefine((value, context) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Place photo links must use http or https",
      });
    }
    if (url.username || url.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Place photo links cannot contain credentials",
      });
    }
  });

export const placeExternalImageInputSchema = z.object({ url: placeImageUrlSchema }).strict();
export const placeImageOrderSchema = z
  .object({
    imageIds: z.array(z.string().trim().min(1)).min(1).max(PLACE_APP_ADMIN_IMAGE_LIMIT),
  })
  .strict();
export const placeImageContentTypeSchema = z.enum(PLACE_IMAGE_CONTENT_TYPES);

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

export const placeSuggestionSchema = placeSuggestionBaseSchema.extend({
  submissionOrigin: placeSubmissionOriginSchema.default("FANHUB"),
});

export const placeUpdateSchema = placeSuggestionBaseSchema
  .omit({ imageUrl: true, imageUrls: true, menuItems: true })
  .partial()
  .extend({
    menuItems: z.array(placeMenuItemSchema).max(20).optional(),
  })
  .strict();

export const placeOwnershipClaimSchema = z.object({
  evidence: z.string().trim().min(10).max(4000),
});

export type PlaceSubmissionOrigin = z.infer<typeof placeSubmissionOriginSchema>;
export type PlaceExternalImageInput = z.infer<typeof placeExternalImageInputSchema>;
export type PlaceImageOrderInput = z.infer<typeof placeImageOrderSchema>;
export type PlaceImageContentType = z.infer<typeof placeImageContentTypeSchema>;
export type PlaceMenuItemInput = z.infer<typeof placeMenuItemSchema>;
export type PlaceSuggestionInput = z.infer<typeof placeSuggestionSchema>;
export type PlaceUpdateInput = z.infer<typeof placeUpdateSchema>;
export type PlaceOwnershipClaimInput = z.infer<typeof placeOwnershipClaimSchema>;
export type PlaceDuplicateMatch = "NAME_ADDRESS" | "PHONE" | "WEBSITE" | "NAME_COORDINATES";
export type PlaceModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

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
  readonly submissionOrigin: PlaceSubmissionOrigin | null;
}

export interface PlaceSuggestionResult {
  readonly outcome: "CREATED" | "EXISTING";
  readonly place: PublicPlaceSummary;
  readonly status: PlaceModerationStatus;
  readonly matchedBy: PlaceDuplicateMatch | null;
  readonly archivedAt: string | null;
}

export interface ManagedPlaceSummary extends PublicPlaceSummary {
  readonly moderationStatus: PlaceModerationStatus;
  readonly archivedAt: string | null;
}

export interface PlaceManagementState extends ManagedPlaceSummary {
  readonly mediaImageLimit: number | null;
}

export interface PlaceReviewApplicant {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
}

export interface PlaceReviewQueueItem {
  readonly id: string;
  readonly status: PlaceModerationStatus;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly applicant: PlaceReviewApplicant;
  readonly place: PublicPlaceSummary;
}

export interface PlaceOwnershipReviewQueueItem extends PlaceReviewQueueItem {
  readonly evidence: string;
}
