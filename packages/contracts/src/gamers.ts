import { z } from "zod";

export const gamerGameStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const gamerGameSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  status: gamerGameStatusSchema,
});

export const gamerGameCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export const gamerGameListSchema = z.object({
  items: z.array(gamerGameSchema),
});

export const gamerProfileInputSchema = z.object({
  handle: z.string().trim().min(1).max(100),
  openToChallenge: z.boolean(),
});

export const gamerProfileSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  gameId: z.string().min(1),
  handle: z.string().min(1),
  openToChallenge: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const gamerChallengerSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  presentation: z.object({
    username: z.string().min(1),
    displayName: z.string().min(1),
    photoUrl: z.string().url().nullable(),
  }),
});

export const gamerChallengerListSchema = z.object({
  items: z.array(gamerChallengerSchema),
});

export type GamerGame = z.infer<typeof gamerGameSchema>;
export type GamerGameCreateInput = z.infer<typeof gamerGameCreateSchema>;
export type GamerGameList = z.infer<typeof gamerGameListSchema>;
export type GamerProfileInput = z.infer<typeof gamerProfileInputSchema>;
export type GamerProfile = z.infer<typeof gamerProfileSchema>;
export type GamerChallenger = z.infer<typeof gamerChallengerSchema>;
export type GamerChallengerList = z.infer<typeof gamerChallengerListSchema>;
