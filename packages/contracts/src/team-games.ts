import { z } from "zod";

export const teamGameScheduleSchema = z
  .object({
    scheduledAt: z.string().datetime(),
    endsAt: z.string().datetime(),
  })
  .superRefine((input, context) => {
    if (new Date(input.endsAt) <= new Date(input.scheduledAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "endsAt must be after scheduledAt",
      });
    }
  });

export type TeamGameScheduleInput = z.infer<typeof teamGameScheduleSchema>;
