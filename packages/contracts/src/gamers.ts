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

export type GamerGame = z.infer<typeof gamerGameSchema>;
export type GamerGameCreateInput = z.infer<typeof gamerGameCreateSchema>;
export type GamerGameList = z.infer<typeof gamerGameListSchema>;
