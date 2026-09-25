import { z } from "zod";
import { athletesSportSchema } from "./athletes.js";
import { placeSubmissionOriginSchema, placeSuggestionSchema } from "./places.js";

export const gearUpOfferTypeSchema = z.enum(["SPORTSWEAR", "GEAR"]);

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

const gearUpShopInputSchema = z
  .object({
    offerTypes: z.array(gearUpOfferTypeSchema).min(1).max(2),
    sports: z.array(athletesSportSchema).min(1).max(9),
    categories: z.array(gearUpProductCategorySchema).min(1).max(GEAR_UP_PRODUCT_CATEGORIES.length),
  })
  .strict();

export const gearUpShopSuggestionSchema = z
  .object({
    place: placeSuggestionSchema,
    shop: gearUpShopInputSchema,
  })
  .strict();

export const gearUpShopUpdateSchema = gearUpShopInputSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, "At least one Gear Up shop field is required");

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

export type GearUpListQueryInput = z.infer<typeof gearUpListQuerySchema>;
export type GearUpOfferType = z.infer<typeof gearUpOfferTypeSchema>;
export type GearUpProductCategory = z.infer<typeof gearUpProductCategorySchema>;
export type GearUpShopSuggestionInput = z.infer<typeof gearUpShopSuggestionSchema>;
export type GearUpShopUpdateInput = z.infer<typeof gearUpShopUpdateSchema>;
export type GearUpProductCreateInput = z.infer<typeof gearUpProductCreateSchema>;
export type GearUpProductUpdateInput = z.infer<typeof gearUpProductUpdateSchema>;
export type GearUpSettingsUpdateInput = z.infer<typeof gearUpSettingsUpdateSchema>;
