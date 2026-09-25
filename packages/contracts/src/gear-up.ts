import { z } from "zod";
import { athletesSportSchema } from "./athletes.js";
import { placeSuggestionSchema } from "./places.js";

export const gearUpOfferTypeSchema = z.enum(["SPORTSWEAR", "GEAR"]);

export const GEAR_UP_PRODUCT_CATEGORIES = [
  "JERSEYS_KITS",
  "TRAINING_WEAR",
  "TOPS",
  "SPORTS_BOTTOMS",
  "TRACKSUITS",
  "FOOTWEAR_BOOTS",
  "FANWEAR",
  "BALLS",
  "GOALKEEPER_GEAR",
  "PROTECTIVE_GEAR",
  "TRAINING_EQUIPMENT",
  "BAGS",
  "GYM_EQUIPMENT",
  "CYCLING_GEAR",
  "ACCESSORIES",
  "OTHER",
] as const;

export const gearUpProductCategorySchema = z.enum(GEAR_UP_PRODUCT_CATEGORIES);

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

export const gearUpShopUpdateSchema = gearUpShopInputSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "At least one Gear Up shop field is required",
);

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

export const gearUpProductUpdateSchema = gearUpProductCreateSchema.partial().refine(
  (input) => Object.keys(input).length > 0,
  "At least one Gear Up product field is required",
);

export const gearUpSettingsUpdateSchema = z
  .object({
    productImageLimit: z.number().int().min(1).max(10),
  })
  .strict();

export type GearUpOfferType = z.infer<typeof gearUpOfferTypeSchema>;
export type GearUpProductCategory = z.infer<typeof gearUpProductCategorySchema>;
export type GearUpShopSuggestionInput = z.infer<typeof gearUpShopSuggestionSchema>;
export type GearUpShopUpdateInput = z.infer<typeof gearUpShopUpdateSchema>;
export type GearUpProductCreateInput = z.infer<typeof gearUpProductCreateSchema>;
export type GearUpProductUpdateInput = z.infer<typeof gearUpProductUpdateSchema>;
export type GearUpSettingsUpdateInput = z.infer<typeof gearUpSettingsUpdateSchema>;
