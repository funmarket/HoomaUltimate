import { z } from "zod";
import { athletesSportSchema } from "./athletes.js";

export const HELP_REQUEST_TYPES = ["SPORT", "COMMUNITY"] as const;
export const helpRequestTypeSchema = z.enum(HELP_REQUEST_TYPES);

export const HELP_TAXONOMY_NEED_KINDS = ["PRODUCT", "COMMUNITY_ROLE", "COMMUNITY_SUPPORT"] as const;
export const helpTaxonomyNeedKindSchema = z.enum(HELP_TAXONOMY_NEED_KINDS);

export const HELP_TAXONOMY_SURFACES = ["REQUESTS", "PLAY", "ATHLETES", "DONATIONS"] as const;
export const helpTaxonomySurfaceSchema = z.enum(HELP_TAXONOMY_SURFACES);

export const helpTaxonomyQuerySchema = z.object({ surface: helpTaxonomySurfaceSchema }).strict();

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

export const helpTaxonomyCommunitySchema = z.object({
  label: z.literal("Community"),
  subcategories: z.array(helpTaxonomySubcategorySchema),
});

export const helpTaxonomyResponseSchema = z.object({
  sports: z.array(helpTaxonomySportSchema),
  community: helpTaxonomyCommunitySchema,
});

export type HelpRequestType = z.infer<typeof helpRequestTypeSchema>;
export type HelpTaxonomyNeedKind = z.infer<typeof helpTaxonomyNeedKindSchema>;
export type HelpTaxonomySurface = z.infer<typeof helpTaxonomySurfaceSchema>;
export type HelpTaxonomyQuery = z.infer<typeof helpTaxonomyQuerySchema>;
export type HelpTaxonomyNeed = z.infer<typeof helpTaxonomyNeedSchema>;
export type HelpTaxonomySubcategory = z.infer<typeof helpTaxonomySubcategorySchema>;
export type HelpTaxonomySport = z.infer<typeof helpTaxonomySportSchema>;
export type HelpTaxonomyCommunity = z.infer<typeof helpTaxonomyCommunitySchema>;
export type HelpTaxonomyResponse = z.infer<typeof helpTaxonomyResponseSchema>;
