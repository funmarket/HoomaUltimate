import { z } from "zod";
import { athletesSportSchema } from "./athletes.js";
import { helpAudienceScopeSchema, helpCategorySchema, helpItemKindSchema } from "./help.js";
import { helpRequestTypeSchema, helpTaxonomyNeedKindSchema } from "./help-taxonomy.js";

const idSchema = z.string().trim().min(1);
const optionalIdSchema = idSchema.optional().nullable();
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional().nullable();

/**
 * A Request photo may be a user-supplied image URL. Only http/https URLs are
 * accepted: `javascript:`, `data:`, `file:` and every other scheme is rejected
 * before the value ever reaches persistence or a renderer.
 */
export const requestImageUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .url()
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Image URL must use the http or https protocol" },
  );

export const requestImageUploadSchema = z.object({
  contentType: z.string().trim().min(1),
  body: z.instanceof(Uint8Array),
});

/**
 * The requester's public presentation, projected from the canonical identity
 * read model. A Request card renders these real facts or nothing at all: it
 * never invents a name, handle or avatar.
 */
export const requestRequesterPresentationSchema = z.object({
  userId: idSchema,
  username: z.string().min(1),
  displayName: z.string().min(1),
  photoUrl: z.string().nullable(),
});

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
    /**
     * Root of the taxonomy selection. Required for every taxonomy-classified Request:
     * `SPORT` needs a sport, `COMMUNITY` needs must not carry one.
     */
    requestType: helpRequestTypeSchema.optional().nullable(),
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
    fullAddress: optionalText(240),
    locationNote: optionalText(240),
    imageUrl: requestImageUrlSchema.optional().nullable(),
    neededByAt: z.string().datetime().optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    const hasSelection = Boolean(input.subcategoryId && input.needId);
    const hasPartialSelection = Boolean(input.subcategoryId || input.needId || input.requestType);
    if (hasPartialSelection && !hasSelection) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Subcategory and need must be provided together",
      });
    }
    if (hasSelection && !input.requestType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Request type is required together with a taxonomy selection",
      });
    }
    if (input.requestType === "SPORT" && !input.sport) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Sport is required for sport requests",
      });
    }
    if (input.requestType === "COMMUNITY" && input.sport) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Community requests must not select a sport",
      });
    }
    if (!hasSelection && !input.category) {
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
  requestType: helpRequestTypeSchema.optional(),
  category: helpCategorySchema.optional(),
  sport: athletesSportSchema.optional(),
  subcategoryId: idSchema.optional(),
  needId: idSchema.optional(),
  surface: helpRequestSurfaceSchema.optional(),
  city: z.string().trim().min(1).max(100).optional(),
  houma: z.string().trim().min(1).max(100).optional(),
  status: helpRequestStatusSchema.optional(),
});

export const helpRequestTaxonomySchema = z.object({
  requestType: helpRequestTypeSchema,
  sport: athletesSportSchema.nullable(),
  sportLabel: z.string().min(1).nullable(),
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
});

export const helpRequestSchema = z.object({
  id: idSchema,
  createdByUserId: idSchema,
  /** Canonical requester identity, or null when the identity read model is not wired. */
  requester: requestRequesterPresentationSchema.nullable(),
  publisherCommunityId: idSchema.nullable(),
  publisherTeamId: idSchema.nullable(),
  publisherAthletesCommunityId: idSchema.nullable(),
  audienceScope: helpAudienceScopeSchema,
  audienceCommunityId: idSchema.nullable(),
  audienceAthletesCommunityId: idSchema.nullable(),
  requestType: helpRequestTypeSchema.nullable(),
  category: helpCategorySchema,
  itemKind: helpItemKindSchema.nullable(),
  sport: athletesSportSchema.nullable(),
  subcategoryId: idSchema.nullable().optional(),
  needId: idSchema.nullable().optional(),
  customNeed: z.string().nullable().optional(),
  taxonomy: helpRequestTaxonomySchema.nullable().optional(),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(1200),
  quantityNeeded: z.number().int().positive().nullable(),
  sizeLabel: z.string().nullable(),
  conditionPreference: requestConditionPreferenceSchema.nullable(),
  placeId: idSchema.nullable(),
  city: z.string().nullable(),
  houma: z.string().nullable(),
  fullAddress: z.string().nullable().optional(),
  locationNote: z.string().nullable(),
  /** The requester-supplied photo URL. Never the private object-storage key. */
  imageUrl: z.string().nullable(),
  /** True when an uploaded photo exists and is served from the Request image route. */
  hasUploadedImage: z.boolean(),
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
export type RequestImageUploadInput = z.infer<typeof requestImageUploadSchema>;
export type RequestRequesterPresentation = z.infer<typeof requestRequesterPresentationSchema>;
export type HelpRequestSurface = z.infer<typeof helpRequestSurfaceSchema>;
export type HelpRequestListQuery = z.infer<typeof helpRequestListQuerySchema>;
export type HelpRequestTaxonomy = z.infer<typeof helpRequestTaxonomySchema>;
export type HelpRequest = z.infer<typeof helpRequestSchema>;
export type HelpRequestResponse = z.infer<typeof helpRequestResponseSchema>;
export type HelpRequestResponseList = z.infer<typeof helpRequestResponseListSchema>;
export type HelpRequestList = z.infer<typeof helpRequestListSchema>;
