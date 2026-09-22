import { z } from "zod";
import { athletesSportSchema } from "./athletes.js";
import { helpAudienceScopeSchema, helpCategorySchema, helpItemKindSchema } from "./help.js";
import { helpTaxonomyNeedKindSchema } from "./help-taxonomy.js";

const idSchema = z.string().trim().min(1);
const optionalIdSchema = idSchema.optional().nullable();
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional().nullable();

export const requestConditionPreferenceSchema = z.enum(["ANY", "NEW_ONLY", "USED_OK"]);
export const helpRequestStatusSchema = z.enum([
  "OPEN",
  "IN_PROGRESS",
  "FULFILLED",
  "CANCELLED",
  "EXPIRED",
]);
export const helpRequestResponseStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "DECLINED",
  "WITHDRAWN",
]);

export const helpRequestPublisherSchema = z
  .object({
    publisherCommunityId: optionalIdSchema,
    publisherTeamId: optionalIdSchema,
    publisherAthletesCommunityId: optionalIdSchema,
  })
  .strict()
  .superRefine((input, context) => {
    const publisherCount = [
      input.publisherCommunityId,
      input.publisherTeamId,
      input.publisherAthletesCommunityId,
    ].filter((value) => value !== undefined && value !== null).length;
    if (publisherCount > 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A Request may have at most one official publisher",
      });
    }
  });

export const helpRequestAudienceSchema = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("PUBLIC") }).strict(),
  z.object({ scope: z.literal("HOOMA_COMMUNITY"), communityId: idSchema }).strict(),
  z.object({ scope: z.literal("ATHLETES_COMMUNITY"), athletesCommunityId: idSchema }).strict(),
]);

export const helpRequestCreateSchema = z
  .object({
    publisher: helpRequestPublisherSchema.default({}),
    audience: helpRequestAudienceSchema,
    category: helpCategorySchema.optional(),
    itemKind: helpItemKindSchema.optional().nullable(),
    sport: athletesSportSchema.optional().nullable(),
    subcategoryId: optionalIdSchema,
    needId: optionalIdSchema,
    customNeed: optionalText(120),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(1200),
    quantityNeeded: z.number().int().positive().optional().nullable(),
    sizeLabel: optionalText(40),
    conditionPreference: requestConditionPreferenceSchema.optional().nullable(),
    placeId: optionalIdSchema,
    city: optionalText(100),
    houma: optionalText(100),
    locationNote: optionalText(240),
    neededByAt: z.string().datetime().optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    const hasTaxonomy = Boolean(input.sport && input.subcategoryId && input.needId);
    const hasAnyTaxonomy = Boolean(input.subcategoryId || input.needId);
    if (hasAnyTaxonomy && !hasTaxonomy) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sport, subcategory and need must be provided together",
      });
    }
    if (!hasTaxonomy && !input.category) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A corrected taxonomy selection or legacy category is required",
      });
    }
  });

export const helpRequestRespondSchema = z.object({ message: z.string().trim().min(1) }).strict();

export const helpRequestSurfaceSchema = z.enum(["REQUESTS", "PLAY", "ATHLETES"]);

export const helpRequestListQuerySchema = z.object({
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  category: helpCategorySchema.optional(),
  sport: athletesSportSchema.optional(),
  subcategoryId: idSchema.optional(),
  needId: idSchema.optional(),
  surface: helpRequestSurfaceSchema.optional(),
  city: z.string().trim().min(1).max(100).optional(),
  houma: z.string().trim().min(1).max(100).optional(),
  status: helpRequestStatusSchema.optional(),
});

export const helpRequestSchema = z.object({
  id: idSchema,
  createdByUserId: idSchema,
  publisherCommunityId: idSchema.nullable(),
  publisherTeamId: idSchema.nullable(),
  publisherAthletesCommunityId: idSchema.nullable(),
  audienceScope: helpAudienceScopeSchema,
  audienceCommunityId: idSchema.nullable(),
  audienceAthletesCommunityId: idSchema.nullable(),
  category: helpCategorySchema,
  itemKind: helpItemKindSchema.nullable(),
  sport: athletesSportSchema.nullable(),
  subcategoryId: idSchema.nullable(),
  needId: idSchema.nullable(),
  customNeed: z.string().nullable(),
  taxonomy: z
    .object({
      sport: athletesSportSchema,
      sportLabel: z.string().min(1),
      subcategory: z.object({
        id: idSchema,
        slug: z.string().min(1),
        label: z.string().min(1),
      }),
      need: z.object({
        id: idSchema,
        slug: z.string().min(1),
        label: z.string().min(1),
        kind: helpTaxonomyNeedKindSchema,
        allowsCustomText: z.boolean(),
      }),
    })
    .nullable(),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(1200),
  quantityNeeded: z.number().int().positive().nullable(),
  sizeLabel: z.string().nullable(),
  conditionPreference: requestConditionPreferenceSchema.nullable(),
  placeId: idSchema.nullable(),
  city: z.string().nullable(),
  houma: z.string().nullable(),
  locationNote: z.string().nullable(),
  neededByAt: z.string().datetime().nullable(),
  expiresAt: z.string().datetime().nullable(),
  status: helpRequestStatusSchema,
  fulfilledAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const helpRequestResponseSchema = z.object({
  id: idSchema,
  requestId: idSchema,
  responderUserId: idSchema,
  message: z.string().min(1),
  status: helpRequestResponseStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  acceptedAt: z.string().datetime().nullable(),
  declinedAt: z.string().datetime().nullable(),
  withdrawnAt: z.string().datetime().nullable(),
});

export const helpRequestResponseListSchema = z.object({
  items: z.array(helpRequestResponseSchema),
});

export const helpRequestListSchema = z.object({
  items: z.array(helpRequestSchema),
  nextCursor: idSchema.nullable(),
});

export type RequestConditionPreference = z.infer<typeof requestConditionPreferenceSchema>;
export type HelpRequestStatus = z.infer<typeof helpRequestStatusSchema>;
export type HelpRequestResponseStatus = z.infer<typeof helpRequestResponseStatusSchema>;
export type HelpRequestPublisherInput = z.infer<typeof helpRequestPublisherSchema>;
export type HelpRequestAudienceInput = z.infer<typeof helpRequestAudienceSchema>;
export type HelpRequestCreateInput = z.infer<typeof helpRequestCreateSchema>;
export type HelpRequestRespondInput = z.infer<typeof helpRequestRespondSchema>;
export type HelpRequestSurface = z.infer<typeof helpRequestSurfaceSchema>;
export type HelpRequestListQuery = z.infer<typeof helpRequestListQuerySchema>;
export type HelpRequest = z.infer<typeof helpRequestSchema>;
export type HelpRequestResponse = z.infer<typeof helpRequestResponseSchema>;
export type HelpRequestResponseList = z.infer<typeof helpRequestResponseListSchema>;
export type HelpRequestList = z.infer<typeof helpRequestListSchema>;
