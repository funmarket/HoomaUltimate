import { z } from "zod";

export const moderationStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED"]);

export const moderationDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().trim().max(1000).optional().nullable(),
});

export type ModerationStatus = z.infer<typeof moderationStatusSchema>;
export type ModerationDecisionInput = z.infer<typeof moderationDecisionSchema>;
