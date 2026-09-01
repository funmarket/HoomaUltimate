import { z } from "zod";

export const ATHLETES_SPORTS = [
  "CYCLING",
  "RUNNING",
  "SWIMMING",
  "FOOTBALL",
  "BASKETBALL",
  "TENNIS",
  "PADEL",
  "GYM_FITNESS",
  "OTHER",
] as const;
export const athletesSportSchema = z.enum(ATHLETES_SPORTS);

export const ATHLETES_ROLES = ["FOUNDER", "MODERATOR", "MEMBER"] as const;
export const athletesRoleSchema = z.enum(ATHLETES_ROLES);

export const athletesVisibilitySchema = z.enum(["PUBLIC", "PRIVATE"]);
export const athletesJoinPolicySchema = z.enum(["OPEN", "APPROVAL_REQUIRED"]);
export const athletesCommunityStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export const athletesJoinRequestStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "DECLINED",
  "CANCELLED",
]);

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUrl = z.string().trim().url().max(2000).nullable().optional();

export const athletesCommunityCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    sport: athletesSportSchema,
    description: optionalText(600),
    city: optionalText(100),
    houma: optionalText(100),
    logoUrl: optionalUrl,
    bannerUrl: optionalUrl,
    visibility: athletesVisibilitySchema.default("PUBLIC"),
    joinPolicy: athletesJoinPolicySchema.default("OPEN"),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.visibility === "PRIVATE" && input.joinPolicy !== "APPROVAL_REQUIRED") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["joinPolicy"],
        message: "Private Athletes communities require approval",
      });
    }
  });

export const athletesCommunityUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    sport: athletesSportSchema.optional(),
    description: optionalText(600),
    city: optionalText(100),
    houma: optionalText(100),
    logoUrl: optionalUrl,
    bannerUrl: optionalUrl,
    visibility: athletesVisibilitySchema.optional(),
    joinPolicy: athletesJoinPolicySchema.optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.visibility === "PRIVATE" && input.joinPolicy === "OPEN") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["joinPolicy"],
        message: "Private Athletes communities require approval",
      });
    }
  });

export const athletesListQuerySchema = z.object({
  sport: athletesSportSchema.optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const athletesPublicSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  sport: athletesSportSchema,
  description: z.string().nullable(),
  city: z.string().nullable(),
  houma: z.string().nullable(),
  logoUrl: z.string().url().nullable(),
  bannerUrl: z.string().url().nullable(),
  visibility: athletesVisibilitySchema,
  joinPolicy: athletesJoinPolicySchema,
  createdAt: z.string().datetime(),
  memberCount: z.number().int().nonnegative(),
});

export const athletesPublicListSchema = z.object({
  items: z.array(athletesPublicSummarySchema),
  nextCursor: z.string().min(1).nullable(),
});

export const athletesPublicDetailSchema = athletesPublicSummarySchema.extend({
  status: athletesCommunityStatusSchema,
  updatedAt: z.string().datetime(),
  viewerRole: athletesRoleSchema.nullable().optional(),
  viewerJoinRequestStatus: athletesJoinRequestStatusSchema.nullable().optional(),
});

export const athletesMemberSchema = z.object({
  userId: z.string().min(1),
  role: athletesRoleSchema,
  joinedAt: z.string().datetime(),
  presentation: z
    .object({
      displayName: z.string().min(1),
      username: z.string().min(1),
      photoUrl: z.string().url().nullable(),
    })
    .nullable(),
});

export const athletesJoinRequestSchema = z.object({
  id: z.string().min(1),
  athletesCommunityId: z.string().min(1),
  userId: z.string().min(1),
  status: athletesJoinRequestStatusSchema,
  requestedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
  resolvedByUserId: z.string().min(1).nullable(),
});

export const athletesJoinRequestForManagerSchema = athletesJoinRequestSchema.extend({
  requester: z.object({ presentation: athletesMemberSchema.shape.presentation }),
});

export const athletesJoinResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("JOINED"), membership: z.object({ role: athletesRoleSchema }) }),
  z.object({ status: z.literal("PENDING"), request: athletesJoinRequestSchema }),
]);

export const athletesMemberAddSchema = z
  .object({ username: z.string().trim().min(1).max(50) })
  .strict();
export const athletesMemberRoleUpdateSchema = z
  .object({ role: z.enum(["MODERATOR", "MEMBER"]) })
  .strict();

export type AthletesSport = z.infer<typeof athletesSportSchema>;
export type AthletesRole = z.infer<typeof athletesRoleSchema>;
export type AthletesVisibility = z.infer<typeof athletesVisibilitySchema>;
export type AthletesJoinPolicy = z.infer<typeof athletesJoinPolicySchema>;
export type AthletesJoinRequestStatus = z.infer<typeof athletesJoinRequestStatusSchema>;
export type AthletesCommunityCreateInput = z.infer<typeof athletesCommunityCreateSchema>;
export type AthletesCommunityUpdateInput = z.infer<typeof athletesCommunityUpdateSchema>;
export type AthletesListQuery = z.infer<typeof athletesListQuerySchema>;
export type AthletesPublicSummary = z.infer<typeof athletesPublicSummarySchema>;
export type AthletesPublicDetail = z.infer<typeof athletesPublicDetailSchema>;
export type AthletesMember = z.infer<typeof athletesMemberSchema>;
export type AthletesJoinResult = z.infer<typeof athletesJoinResultSchema>;
export type AthletesJoinRequest = z.infer<typeof athletesJoinRequestSchema>;
export type AthletesJoinRequestForManager = z.infer<typeof athletesJoinRequestForManagerSchema>;
export type AthletesMemberAdd = z.infer<typeof athletesMemberAddSchema>;
