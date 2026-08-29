import { z } from "zod";

export const playLookingForSchema = z.enum(["GAME", "TEAM"]);

export const playPlayerListingInputSchema = z.object({
  lookingFor: playLookingForSchema,
});

export const playTeamOfferInputSchema = z.object({
  teamId: z.string().min(1),
  message: z.string().trim().max(240).optional().nullable(),
});

export const playEventInviteInputSchema = z.object({
  eventId: z.string().min(1),
});

export type PlayLookingFor = z.infer<typeof playLookingForSchema>;
export type PlayPlayerListingInput = z.infer<typeof playPlayerListingInputSchema>;
export type PlayTeamOfferInput = z.infer<typeof playTeamOfferInputSchema>;
export type PlayEventInviteInput = z.infer<typeof playEventInviteInputSchema>;
