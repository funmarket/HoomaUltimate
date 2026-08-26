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

export const gamerPublicPresentationSchema = z.object({
  username: z.string().min(1),
  displayName: z.string().min(1),
  photoUrl: z.string().url().nullable(),
});

export const gamerChallengerSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  presentation: gamerPublicPresentationSchema,
});

export const gamerChallengerListSchema = z.object({
  items: z.array(gamerChallengerSchema),
});

export const gamerDiscoveryItemSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  openToChallenge: z.boolean(),
  game: gamerGameSchema.pick({ id: true, slug: true, name: true }),
  presentation: gamerPublicPresentationSchema,
});

export const gamerDiscoveryListSchema = z.object({
  items: z.array(gamerDiscoveryItemSchema),
});

export const gamerChallengeStatusSchema = z.enum(["PENDING", "ACCEPTED", "DECLINED", "CANCELLED"]);

export const gamerChallengeCreateSchema = z.object({
  challengedProfileId: z.string().min(1),
});

export const gamerChallengeParticipantSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  presentation: gamerPublicPresentationSchema,
});

export const gamerChallengeSchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  status: gamerChallengeStatusSchema,
  createdAt: z.string().datetime(),
  respondedAt: z.string().datetime().nullable(),
  cancelledAt: z.string().datetime().nullable(),
  challenger: gamerChallengeParticipantSchema,
  challenged: gamerChallengeParticipantSchema,
});

export const gamerChallengeListSchema = z.object({
  items: z.array(gamerChallengeSchema),
});

export const gamerArenaQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
});

export const gamerArenaMatchSchema = z.object({
  id: z.string().min(1),
  status: z.literal("ACCEPTED"),
  game: gamerGameSchema.pick({ id: true, slug: true, name: true }),
  challenger: gamerChallengeParticipantSchema,
  challenged: gamerChallengeParticipantSchema,
});

export const gamerArenaMatchListSchema = z.object({
  items: z.array(gamerArenaMatchSchema),
  nextCursor: z.string().min(1).nullable(),
});

export type GamerGame = z.infer<typeof gamerGameSchema>;
export type GamerGameCreateInput = z.infer<typeof gamerGameCreateSchema>;
export type GamerGameList = z.infer<typeof gamerGameListSchema>;
export type GamerProfileInput = z.infer<typeof gamerProfileInputSchema>;
export type GamerProfile = z.infer<typeof gamerProfileSchema>;
export type GamerChallenger = z.infer<typeof gamerChallengerSchema>;
export type GamerChallengerList = z.infer<typeof gamerChallengerListSchema>;
export type GamerDiscoveryItem = z.infer<typeof gamerDiscoveryItemSchema>;
export type GamerDiscoveryList = z.infer<typeof gamerDiscoveryListSchema>;
export type GamerChallengeStatus = z.infer<typeof gamerChallengeStatusSchema>;
export type GamerChallengeCreateInput = z.infer<typeof gamerChallengeCreateSchema>;
export type GamerChallengeParticipant = z.infer<typeof gamerChallengeParticipantSchema>;
export type GamerChallenge = z.infer<typeof gamerChallengeSchema>;
export type GamerChallengeList = z.infer<typeof gamerChallengeListSchema>;
export type GamerArenaQuery = z.infer<typeof gamerArenaQuerySchema>;
export type GamerArenaMatch = z.infer<typeof gamerArenaMatchSchema>;
export type GamerArenaMatchList = z.infer<typeof gamerArenaMatchListSchema>;
