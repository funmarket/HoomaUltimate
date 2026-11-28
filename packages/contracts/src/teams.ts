import { z } from "zod";

export const TEAM_IDENTITY_MEDIA_RECONCILE_TOPIC = "team.identity-media.reconcile-object";
export const teamIdentityMediaCleanupPayloadSchema = z.object({
  teamId: z.string().min(1),
  mediaId: z.string().min(1),
  slot: z.enum(["badge", "banner"]),
  objectKey: z.string().min(1),
});
export type TeamIdentityMediaCleanupPayload = z.infer<typeof teamIdentityMediaCleanupPayloadSchema>;
