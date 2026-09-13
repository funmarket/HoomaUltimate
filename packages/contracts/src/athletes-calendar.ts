import { z } from "zod";

export const ATHLETES_CALENDAR_MAX_RANGE_DAYS = 45;
export const athletesCalendarEntryStatusSchema = z.enum(["SCHEDULED", "CANCELLED"]);

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const athletesCalendarTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(validTimeZone, "Calendar timezone must be a valid IANA timezone");

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

export const athletesCalendarRangeSchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  })
  .strict()
  .superRefine((input, context) => {
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (to <= from) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: "Calendar range end must be after start",
      });
      return;
    }
    const maxMilliseconds = ATHLETES_CALENDAR_MAX_RANGE_DAYS * 24 * 60 * 60 * 1000;
    if (to.getTime() - from.getTime() > maxMilliseconds) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["to"],
        message: `Calendar range cannot exceed ${ATHLETES_CALENDAR_MAX_RANGE_DAYS} days`,
      });
    }
  });

const calendarWriteFields = {
  title: z.string().trim().min(1).max(120),
  description: optionalText(1000),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  timezone: athletesCalendarTimezoneSchema.default("Africa/Tunis"),
  locationName: optionalText(160),
};

function validateTimes(
  input: { startsAt: string; endsAt?: string | null | undefined },
  context: z.RefinementCtx,
) {
  if (input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: "Calendar event end must be after start",
    });
  }
}

export const athletesCalendarEntryCreateSchema = z
  .object(calendarWriteFields)
  .strict()
  .superRefine(validateTimes);

export const athletesCalendarEntryUpdateSchema = z
  .object(calendarWriteFields)
  .strict()
  .superRefine(validateTimes);

export const athletesCalendarEntrySchema = z
  .object({
    id: z.string().min(1),
    athletesCommunityId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable(),
    timezone: athletesCalendarTimezoneSchema,
    locationName: z.string().nullable(),
    status: athletesCalendarEntryStatusSchema,
    cancelledAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const athletesCalendarListSchema = z.array(athletesCalendarEntrySchema);

export type AthletesCalendarRange = z.infer<typeof athletesCalendarRangeSchema>;
export type AthletesCalendarEntryCreateInput = z.infer<typeof athletesCalendarEntryCreateSchema>;
export type AthletesCalendarEntryUpdateInput = z.infer<typeof athletesCalendarEntryUpdateSchema>;
export type AthletesCalendarEntry = z.infer<typeof athletesCalendarEntrySchema>;
export type AthletesCalendarEntryStatus = z.infer<typeof athletesCalendarEntryStatusSchema>;
