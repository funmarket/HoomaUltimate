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

export const ATHLETES_PHOTO_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ATHLETES_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const athletesPhotoContentTypeSchema = z.enum(ATHLETES_PHOTO_CONTENT_TYPES);

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalUrl = z.string().trim().url().max(2000).nullable().optional();
const ATHLETES_CALENDAR_MAX_RANGE_MS = 45 * 24 * 60 * 60 * 1000;

function validIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

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
  lastSeenAt: z.string().datetime().nullable(),
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

export const athletesPhotoMetadataSchema = z
  .object({
    id: z.string().min(1),
    athletesCommunityId: z.string().min(1),
    contentType: athletesPhotoContentTypeSchema,
    sizeBytes: z.number().int().positive().max(ATHLETES_PHOTO_MAX_BYTES),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const athletesPhotoDeliverySchema = z
  .object({
    contentUrl: z.string().url(),
    expiresAt: z.string().datetime(),
  })
  .strict();

export const athletesPhotoListSchema = z.array(athletesPhotoMetadataSchema);
export const athletesPhotoUploadResponseSchema = athletesPhotoMetadataSchema;

const athletesCalendarTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(validIanaTimezone, "Timezone must be a valid IANA timezone");

export const athletesCalendarCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    description: optionalText(600),
    location: optionalText(200),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    timezone: athletesCalendarTimezoneSchema,
  })
  .strict()
  .superRefine((input, context) => {
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Calendar entry must end after it starts",
      });
    }
  });

export const athletesCalendarUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(100).optional(),
    description: optionalText(600),
    location: optionalText(200),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    timezone: athletesCalendarTimezoneSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, "At least one Calendar field is required")
  .superRefine((input, context) => {
    if (input.startsAt && input.endsAt && Date.parse(input.endsAt) <= Date.parse(input.startsAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Calendar entry must end after it starts",
      });
    }
  });

export const athletesCalendarEntrySchema = z
  .object({
    id: z.string().min(1),
    athletesCommunityId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable(),
    location: z.string().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    timezone: athletesCalendarTimezoneSchema,
    cancelledAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const athletesCalendarRsvpStatusSchema = z.enum(["GOING", "MAYBE", "NOT_GOING"]);
export const athletesCalendarRsvpCountsSchema = z
  .object({
    going: z.number().int().nonnegative(),
    maybe: z.number().int().nonnegative(),
    notGoing: z.number().int().nonnegative(),
  })
  .strict();
export const athletesCalendarRsvpSummarySchema = z
  .object({
    viewerStatus: athletesCalendarRsvpStatusSchema.nullable(),
    counts: athletesCalendarRsvpCountsSchema,
  })
  .strict();
export const athletesCalendarEntryViewSchema = athletesCalendarEntrySchema.extend({
  rsvp: athletesCalendarRsvpSummarySchema,
});
export const athletesCalendarRsvpInputSchema = z
  .object({ status: athletesCalendarRsvpStatusSchema })
  .strict();
export const athletesCalendarRsvpResultSchema = z
  .object({
    entryId: z.string().min(1),
    status: athletesCalendarRsvpStatusSchema,
  })
  .strict();

export const athletesCalendarListSchema = z.array(athletesCalendarEntrySchema);
export const athletesCalendarListViewSchema = z.array(athletesCalendarEntryViewSchema);
export const athletesCalendarListQuerySchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .strict()
  .superRefine((input, context) => {
    const from = Date.parse(input.from);
    const to = Date.parse(input.to);
    if (to <= from) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "Calendar range must end after it starts",
      });
      return;
    }
    if (to - from > ATHLETES_CALENDAR_MAX_RANGE_MS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "Calendar range cannot exceed 45 days",
      });
    }
  });

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
export type AthletesPhotoContentType = z.infer<typeof athletesPhotoContentTypeSchema>;
export type AthletesCommunityCreateInput = z.infer<typeof athletesCommunityCreateSchema>;
export type AthletesCommunityUpdateInput = z.infer<typeof athletesCommunityUpdateSchema>;
export type AthletesListQuery = z.infer<typeof athletesListQuerySchema>;
export type AthletesPublicSummary = z.infer<typeof athletesPublicSummarySchema>;
export type AthletesPublicDetail = z.infer<typeof athletesPublicDetailSchema>;
export type AthletesMember = z.infer<typeof athletesMemberSchema>;
export type AthletesJoinResult = z.infer<typeof athletesJoinResultSchema>;
export type AthletesJoinRequest = z.infer<typeof athletesJoinRequestSchema>;
export type AthletesJoinRequestForManager = z.infer<typeof athletesJoinRequestForManagerSchema>;
export type AthletesPhotoMetadata = z.infer<typeof athletesPhotoMetadataSchema>;
export type AthletesPhotoDelivery = z.infer<typeof athletesPhotoDeliverySchema>;
export type AthletesPhotoList = z.infer<typeof athletesPhotoListSchema>;
export type AthletesPhotoUploadResponse = z.infer<typeof athletesPhotoUploadResponseSchema>;
export type AthletesCalendarCreateInput = z.infer<typeof athletesCalendarCreateSchema>;
export type AthletesCalendarUpdateInput = z.infer<typeof athletesCalendarUpdateSchema>;
export type AthletesCalendarEntry = z.infer<typeof athletesCalendarEntrySchema>;
export type AthletesCalendarRsvpStatus = z.infer<typeof athletesCalendarRsvpStatusSchema>;
export type AthletesCalendarRsvpCounts = z.infer<typeof athletesCalendarRsvpCountsSchema>;
export type AthletesCalendarRsvpSummary = z.infer<typeof athletesCalendarRsvpSummarySchema>;
export type AthletesCalendarEntryView = z.infer<typeof athletesCalendarEntryViewSchema>;
export type AthletesCalendarRsvpInput = z.infer<typeof athletesCalendarRsvpInputSchema>;
export type AthletesCalendarRsvpResult = z.infer<typeof athletesCalendarRsvpResultSchema>;
export type AthletesCalendarList = z.infer<typeof athletesCalendarListSchema>;
export type AthletesCalendarListView = z.infer<typeof athletesCalendarListViewSchema>;
export type AthletesCalendarListQuery = z.infer<typeof athletesCalendarListQuerySchema>;
export type AthletesMemberAdd = z.infer<typeof athletesMemberAddSchema>;

/** Create/update return community fields; member counts belong to read projections. */
export type AthletesCommunityWriteResult = Omit<
  AthletesPublicDetail,
  "memberCount" | "viewerRole" | "viewerJoinRequestStatus"
>;

export const athletesPhotoListQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});

export const ATHLETES_PHOTO_RECONCILE_TOPIC = "athletes.photo.reconcile-object";
export const athletesPhotoCleanupPayloadSchema = z
  .object({
    photoId: z.string().min(1),
    athletesCommunityId: z.string().min(1),
    objectKey: z.string().min(1),
  })
  .strict();
