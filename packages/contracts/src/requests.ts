import { z } from "zod";
import { athletesSportSchema } from "./athletes.js";
import { helpAudienceScopeSchema, helpCategorySchema, helpItemKindSchema } from "./help.js";
import { helpRequestTypeSchema, helpTaxonomyNeedKindSchema } from "./help-taxonomy.js";

const idSchema = z.string().trim().min(1);
const optionalIdSchema = idSchema.optional().nullable();
const optionalText = (max: number) => z.string().trim().min(1).max(max).optional().nullable();

export const REQUEST_IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const REQUEST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const REQUEST_IMAGE_RECONCILE_TOPIC = "request.image.reconcile-object";
export const helpRequestImageContentTypeSchema = z.enum(REQUEST_IMAGE_CONTENT_TYPES);
export const helpRequestImageSourceSchema = z.enum(["UPLOAD", "EXTERNAL_URL"]);

const requestExternalImageUrlSchema = z
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
        message: "Request image links must use http or https",
      });
    }
    if (url.username || url.password) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Request image links cannot contain credentials",
      });
    }
  });

export const helpRequestExternalImageInputSchema = z
  .object({ url: requestExternalImageUrlSchema })
  .strict();

export const helpRequestImageSchema = z.object({
  id: idSchema,
  source: helpRequestImageSourceSchema,
  contentType: helpRequestImageContentTypeSchema.nullable(),
  sizeBytes: z.number().int().positive().nullable(),
  updatedAt: z.string().datetime(),
});

export const helpRequestImageDeliverySchema = z.object({
  contentUrl: z.string().url(),
  expiresAt: z.string().datetime().nullable(),
});

export const helpRequestImageCleanupPayloadSchema = z
  .object({
    requestId: idSchema,
    objectKey: z.string().trim().min(1),
  })
  .strict();

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
    requestType: helpRequestTypeSchema.optional().nullable(),
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
    neededByAt: z.string().datetime().optional().nullable(),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .strict()
  .superRefine((input, context) => {
    const hasCompleteTaxonomy = Boolean(input.subcategoryId && input.needId);
    const hasAnyTaxonomy = Boolean(input.subcategoryId || input.needId);

    if (hasAnyTaxonomy && !hasCompleteTaxonomy) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Subcategory and need must be provided together",
      });
      return;
    }

    if (input.requestType === "SPORT") {
      if (!input.sport || !hasCompleteTaxonomy) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Sport Requests require sport, subcategory and need",
        });
      }
      return;
    }

    if (input.requestType === "COMMUNITY") {
      if (input.sport) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Community Requests do not accept a sport",
        });
      }
      if (!hasCompleteTaxonomy) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Community Requests require subcategory and need",
        });
      }
      return;
    }

    const compatibleSportTaxonomy = Boolean(input.sport && hasCompleteTaxonomy);
    if (hasAnyTaxonomy && !compatibleSportTaxonomy) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Legacy corrected Requests require sport, subcategory and need",
      });
    }
    if (!compatibleSportTaxonomy && !input.category) {
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
  requestType: helpRequestTypeSchema.optional(),
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
  requestType: helpRequestTypeSchema.nullable().optional(),
  sport: athletesSportSchema.nullable(),
  subcategoryId: idSchema.nullable().optional(),
  needId: idSchema.nullable().optional(),
  customNeed: z.string().nullable().optional(),
  requester: z
    .object({
      displayName: z.string(),
      username: z.string(),
      photoUrl: z.string().nullable(),
    })
    .nullable()
    .optional(),
  taxonomy: z
    .object({
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
    })
    .nullable()
    .optional(),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(1200),
  quantityNeeded: z.number().int().positive().nullable(),
  sizeLabel: z.string().nullable(),
  conditionPreference: requestConditionPreferenceSchema.nullable(),
  placeId: idSchema.nullable(),
  city: z.string().nullable(),
  houma: z.string().nullable(),
  locationNote: z.string().nullable(),
  image: helpRequestImageSchema.nullable().optional(),
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

export type RequestImageContentType = z.infer<typeof helpRequestImageContentTypeSchema>;
export type HelpRequestImageSource = z.infer<typeof helpRequestImageSourceSchema>;
export type HelpRequestExternalImageInput = z.infer<typeof helpRequestExternalImageInputSchema>;
export type HelpRequestImage = z.infer<typeof helpRequestImageSchema>;
export type HelpRequestImageDelivery = z.infer<typeof helpRequestImageDeliverySchema>;
