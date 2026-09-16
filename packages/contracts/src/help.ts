import { z } from "zod";

export const HELP_AUDIENCE_SCOPES = [
  "PUBLIC",
  "HOOMA_COMMUNITY",
  "ATHLETES_COMMUNITY",
] as const;
export const helpAudienceScopeSchema = z.enum(HELP_AUDIENCE_SCOPES);
export type HelpAudienceScope = z.infer<typeof helpAudienceScopeSchema>;

export const HELP_CATEGORIES = [
  "PEOPLE",
  "ITEM",
  "PLACE",
  "TRANSPORT",
  "SERVICE",
  "EDUCATION",
  "COMMUNITY",
  "OTHER",
] as const;
export const helpCategorySchema = z.enum(HELP_CATEGORIES);
export type HelpCategory = z.infer<typeof helpCategorySchema>;

export const HELP_ITEM_KINDS = [
  "FOOTWEAR",
  "CLOTHING",
  "SPORTS_GEAR",
  "BOOKS",
  "EQUIPMENT",
  "SCHOOL_SUPPLIES",
  "HOUSEHOLD",
  "BIKE",
  "OTHER",
] as const;
export const helpItemKindSchema = z.enum(HELP_ITEM_KINDS);
export type HelpItemKind = z.infer<typeof helpItemKindSchema>;
