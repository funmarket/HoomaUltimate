import { z } from "zod";

const idSchema = z.string().trim().min(1);

export const rideCommunityRequesterPresentationSchema = z.object({
  displayName: z.string().min(1),
  username: z.string().min(1),
  photoUrl: z.string().nullable(),
});

export const rideRequestCommunityInteractionSchema = z.object({
  requestId: idSchema,
  requester: rideCommunityRequesterPresentationSchema.nullable(),
  canWhistle: z.boolean(),
});

export type RideCommunityRequesterPresentation = z.infer<
  typeof rideCommunityRequesterPresentationSchema
>;
export type RideRequestCommunityInteraction = z.infer<
  typeof rideRequestCommunityInteractionSchema
>;
