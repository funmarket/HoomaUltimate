import { z } from "zod";

export const playLookingForSchema = z.enum(["GAME", "TEAM"]);

export const playPlayerListingInputSchema = z.object({
  lookingFor: playLookingForSchema,
});

export type PlayLookingFor = z.infer<typeof playLookingForSchema>;
export type PlayPlayerListingInput = z.infer<typeof playPlayerListingInputSchema>;
