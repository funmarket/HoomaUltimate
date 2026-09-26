import { z } from "zod";
import { athletesSportSchema, type AthletesSport } from "./athletes.js";
import {
  placeSubmissionOriginSchema,
  placeSuggestionSchema,
  type PlaceModerationStatus,
  type PlaceReviewApplicant,
  type PublicPlaceSummary,
} from "./places.js";

export const gearUpOfferTypeSchema = z.enum(["SPORTSWEAR", "GEAR"]);

export const GEAR_UP_PAYMENT_METHODS = ["CASH", "CRYPTO", "CARD_BY_PHONE"] as const;
export const gearUpPaymentMethodSchema = z.enum(GEAR_UP_PAYMENT_METHODS);

export const GEAR_UP_PRODUCT_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const GEAR_UP_PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const GEAR_UP_PRODUCT_IMAGE_RECONCILE_TOPIC = "gear-up.product-image.reconcile-object";

export const gearUpProductImageContentTypeSchema = z.enum(GEAR_UP_PRODUCT_IMAGE_CONTENT_TYPES);
export const gearUpProductImageSourceSchema = z.enum(["UPLOAD", "EXTERNAL_URL"]);

const gearUpProductExternalImageUrlSchema = z
  .string()
  .trim()
  .url()
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
        message: "Gear Up product image links must use http or https",
      });
    }
    if (url.username || url.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gear Up product image links cannot contain credentials",
      });
    }
  });

export const gearUpProductExternalImageInputSchema = z
  .object({ url: gearUpProductExternalImageUrlSchema })
  .strict();

export const gearUpProductImageOrderSchema = z
  .object({
    imageIds: z
      .array(z.string().trim().min(1))
      .min(1)
      .max(10)
      .superRefine((value, context) => {
        if (new Set(value).size !== value.length) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Gear Up product image order cannot contain duplicate images",
          });
        }
      }),
  })
  .strict();

export const gearUpProductImageSchema = z.object({
  id: z.string().trim().min(1),
  source: gearUpProductImageSourceSchema,
  contentType: gearUpProductImageContentTypeSchema.nullable(),
  sizeBytes: z.number().int().positive().nullable(),
  sortOrder: z.number().int().min(0),
  updatedAt: z.string().datetime(),
});

export const gearUpProductImageDeliverySchema = z.object({
  contentUrl: z.string().url(),
  expiresAt: z.string().datetime().nullable(),
});

export const gearUpProductImageCleanupPayloadSchema = z
  .object({
    productId: z.string().trim().min(1),
    objectKey: z.string().trim().min(1),
  })
  .strict();

export const gearUpSettingsSchema = z.object({
  productImageLimit: z.number().int().min(1).max(10),
});

export const GEAR_UP_SPORTSWEAR_CATEGORIES = [
  "JERSEYS_KITS",
  "TRAINING_WEAR",
  "TOPS",
  "HOODIES_SWEATSHIRTS",
  "JACKETS_OUTERWEAR",
  "SPORTS_BOTTOMS",
  "TRACKSUITS",
  "BASE_LAYERS_COMPRESSION",
  "SOCKS",
  "SWIMWEAR",
  "FOOTWEAR_BOOTS",
  "FANWEAR",
] as const;

export const GEAR_UP_GEAR_CATEGORIES = [
  "BALLS",
  "RACKETS_PADDLES",
  "GOALS_NETS_HOOPS",
  "GOALKEEPER_GEAR",
  "PROTECTIVE_GEAR",
  "TRAINING_EQUIPMENT",
  "REFEREE_OFFICIALS_EQUIPMENT",
  "BAGS",
  "GYM_EQUIPMENT",
  "CYCLING_GEAR",
  "SWIMMING_EQUIPMENT",
  "SUPPORTS_STRAPS_TAPE",
  "HYDRATION_BOTTLES",
  "ACCESSORIES",
  "OTHER",
] as const;

export const GEAR_UP_PRODUCT_CATEGORIES = [
  ...GEAR_UP_SPORTSWEAR_CATEGORIES,
  ...GEAR_UP_GEAR_CATEGORIES,
] as const;

export const GEAR_UP_PRODUCT_CATEGORY_LABELS = {
  JERSEYS_KITS: "Jerseys & Kits",
  TRAINING_WEAR: "Training Wear",
  TOPS: "Tops & T-Shirts",
  HOODIES_SWEATSHIRTS: "Hoodies & Sweatshirts",
  JACKETS_OUTERWEAR: "Jackets & Outerwear",
  SPORTS_BOTTOMS: "Shorts, Trousers, Tights & Leggings",
  TRACKSUITS: "Tracksuits",
  BASE_LAYERS_COMPRESSION: "Base Layers & Compression",
  SOCKS: "Socks",
  SWIMWEAR: "Swimwear",
  FOOTWEAR_BOOTS: "Footwear, Boots & Shoes",
  FANWEAR: "Fan & Supporter Wear",
  BALLS: "Balls",
  RACKETS_PADDLES: "Rackets & Paddles",
  GOALS_NETS_HOOPS: "Goals, Nets & Hoops",
  GOALKEEPER_GEAR: "Goalkeeper Equipment",
  PROTECTIVE_GEAR: "Protective Equipment",
  TRAINING_EQUIPMENT: "Training & Coaching Equipment",
  REFEREE_OFFICIALS_EQUIPMENT: "Referee & Officials Equipment",
  BAGS: "Bags & Backpacks",
  GYM_EQUIPMENT: "Gym & Fitness Equipment",
  CYCLING_GEAR: "Cycling Equipment",
  SWIMMING_EQUIPMENT: "Swimming Equipment",
  SUPPORTS_STRAPS_TAPE: "Supports, Straps & Tape",
  HYDRATION_BOTTLES: "Water Bottles & Hydration",
  ACCESSORIES: "Sports Accessories",
  OTHER: "Other",
} as const satisfies Record<(typeof GEAR_UP_PRODUCT_CATEGORIES)[number], string>;

export const gearUpProductCategorySchema = z.enum(GEAR_UP_PRODUCT_CATEGORIES);

export const gearUpListQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    source: placeSubmissionOriginSchema.optional(),
    offer: gearUpOfferTypeSchema.optional(),
    sport: athletesSportSchema.optional(),
    category: gearUpProductCategorySchema.optional(),
    city: z.string().trim().max(100).optional(),
    houma: z.string().trim().max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();

export const gearUpProductDiscoveryQuerySchema = z
  .object({
    q: z.string().trim().max(120).optional(),
    offer: gearUpOfferTypeSchema.optional(),
    sport: athletesSportSchema.optional(),
    category: gearUpProductCategorySchema.optional(),
    city: z.string().trim().max(100).optional(),
    houma: z.string().trim().max(100).optional(),
    featured: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    cursor: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(30),
  })
  .strict();

const gearUpShopInputSchema = z
  .object({
    offerTypes: z.array(gearUpOfferTypeSchema).min(1).max(2),
    sports: z.array(athletesSportSchema).min(1).max(9),
    categories: z.array(gearUpProductCategorySchema).min(1).max(GEAR_UP_PRODUCT_CATEGORIES.length),
    paymentMethods: z
      .array(gearUpPaymentMethodSchema)
      .max(GEAR_UP_PAYMENT_METHODS.length)
      .default([]),
  })
  .strict();

export const gearUpShopSuggestionSchema = z
  .object({
    place: placeSuggestionSchema,
    shop: gearUpShopInputSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (input.place.submissionOrigin === "OWNER" && input.shop.paymentMethods.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shop", "paymentMethods"],
        message: "Owner-submitted Gear Up shops must accept at least one payment method",
      });
    }
  });

export const gearUpShopUpdateSchema = gearUpShopInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one Gear Up shop field is required")
  .superRefine((input, context) => {
    if (input.paymentMethods !== undefined && input.paymentMethods.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentMethods"],
        message: "Gear Up payment methods cannot be empty when provided",
      });
    }
  });

export const gearUpProductCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    brand: z.string().trim().max(120).optional().nullable(),
    description: z.string().trim().min(1).max(2000),
    sports: z.array(athletesSportSchema).min(1).max(9),
    category: gearUpProductCategorySchema,
    price: z.number().min(0).max(1_000_000_000).optional().nullable(),
    currency: z.string().trim().length(3).default("TND"),
  })
  .strict();

export const gearUpProductUpdateSchema = gearUpProductCreateSchema
  .partial()
  .refine(
    (input) => Object.keys(input).length > 0,
    "At least one Gear Up product field is required",
  );

export const gearUpSettingsUpdateSchema = z
  .object({
    productImageLimit: z.number().int().min(1).max(10),
  })
  .strict();

export interface PublicGearUpShop {
  readonly place: PublicPlaceSummary;
  readonly offerTypes: readonly GearUpOfferType[];
  readonly sports: readonly AthletesSport[];
  readonly categories: readonly GearUpProductCategory[];
  readonly paymentMethods: readonly GearUpPaymentMethod[];
  readonly verifiedOwner: boolean;
}

export interface ManagedGearUpShop extends PublicGearUpShop {
  readonly moderationStatus: PlaceModerationStatus;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface GearUpReviewQueueItem {
  readonly placeId: string;
  readonly status: PlaceModerationStatus;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly applicant: PlaceReviewApplicant;
  readonly shop: PublicGearUpShop;
}

export interface GearUpProductShopContext {
  readonly placeId: string;
  readonly name: string;
  readonly address: string;
  readonly city: string | null;
  readonly houma: string | null;
}

export interface PublicGearUpProductListing extends GearUpProduct {
  readonly shop: GearUpProductShopContext;
}

export interface GearUpProductDiscoveryPage {
  readonly items: readonly PublicGearUpProductListing[];
  readonly nextCursor: string | null;
}

export interface GearUpProduct {
  readonly id: string;
  readonly shopPlaceId: string;
  readonly title: string;
  readonly brand: string | null;
  readonly description: string;
  readonly sports: readonly AthletesSport[];
  readonly category: GearUpProductCategory;
  readonly price: number | null;
  readonly currency: string;
  readonly coverImageId: string | null;
  readonly featuredAt: string | null;
  readonly archivedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type GearUpProductImageContentType = z.infer<typeof gearUpProductImageContentTypeSchema>;
export type GearUpProductImageSource = z.infer<typeof gearUpProductImageSourceSchema>;
export type GearUpProductExternalImageInput = z.infer<typeof gearUpProductExternalImageInputSchema>;
export type GearUpProductImageOrderInput = z.infer<typeof gearUpProductImageOrderSchema>;
export type GearUpProductImage = z.infer<typeof gearUpProductImageSchema>;
export type GearUpProductImageDelivery = z.infer<typeof gearUpProductImageDeliverySchema>;
export type GearUpSettings = z.infer<typeof gearUpSettingsSchema>;
export type GearUpListQueryInput = z.infer<typeof gearUpListQuerySchema>;
export type GearUpProductDiscoveryQueryInput = z.infer<
  typeof gearUpProductDiscoveryQuerySchema
>;
export type GearUpOfferType = z.infer<typeof gearUpOfferTypeSchema>;
export type GearUpPaymentMethod = z.infer<typeof gearUpPaymentMethodSchema>;
export type GearUpProductCategory = z.infer<typeof gearUpProductCategorySchema>;
export type GearUpShopSuggestionInput = z.infer<typeof gearUpShopSuggestionSchema>;
export type GearUpShopUpdateInput = z.infer<typeof gearUpShopUpdateSchema>;
export type GearUpProductCreateInput = z.infer<typeof gearUpProductCreateSchema>;
export type GearUpProductUpdateInput = z.infer<typeof gearUpProductUpdateSchema>;
export type GearUpSettingsUpdateInput = z.infer<typeof gearUpSettingsUpdateSchema>;
