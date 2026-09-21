import { z } from "zod";
import { athletesSportSchema } from "./athletes.js";

export const HELP_TAXONOMY_NEED_KINDS = [
  "PRODUCT",
  "COMMUNITY_ROLE",
  "COMMUNITY_SUPPORT",
] as const;
export const helpTaxonomyNeedKindSchema = z.enum(HELP_TAXONOMY_NEED_KINDS);

export const HELP_TAXONOMY_SURFACES = ["REQUESTS", "PLAY", "ATHLETES", "DONATIONS"] as const;
export const helpTaxonomySurfaceSchema = z.enum(HELP_TAXONOMY_SURFACES);

export const helpTaxonomyQuerySchema = z
  .object({
    surface: helpTaxonomySurfaceSchema,
  })
  .strict();

export const helpTaxonomyNeedSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  label: z.string().min(1),
  kind: helpTaxonomyNeedKindSchema,
  allowsCustomText: z.boolean(),
  sortOrder: z.number().int(),
});

export const helpTaxonomySubcategorySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  label: z.string().min(1),
  sortOrder: z.number().int(),
  needs: z.array(helpTaxonomyNeedSchema),
});

export const helpTaxonomySportSchema = z.object({
  sport: athletesSportSchema,
  label: z.string().min(1),
  subcategories: z.array(helpTaxonomySubcategorySchema),
});

export const helpTaxonomyResponseSchema = z.object({
  sports: z.array(helpTaxonomySportSchema),
});


export type HelpTaxonomyNeedKind = z.infer<typeof helpTaxonomyNeedKindSchema>;
export type HelpTaxonomySurface = z.infer<typeof helpTaxonomySurfaceSchema>;
export type HelpTaxonomyQuery = z.infer<typeof helpTaxonomyQuerySchema>;
export type HelpTaxonomyNeed = z.infer<typeof helpTaxonomyNeedSchema>;
export type HelpTaxonomySubcategory = z.infer<typeof helpTaxonomySubcategorySchema>;
export type HelpTaxonomySport = z.infer<typeof helpTaxonomySportSchema>;
export type HelpTaxonomyResponse = z.infer<typeof helpTaxonomyResponseSchema>;
