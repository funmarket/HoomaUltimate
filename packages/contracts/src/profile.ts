import { z } from "zod";
import {
  TEAM_POSITION_ROLES,
  displayNameSchema,
  skillLevelSchema,
  usernameSchema,
} from "./index";

export const PROFILE_IDENTITIES = ["PLAYER", "FAN", "GAMER"] as const;
export const profileIdentitySchema = z.enum(PROFILE_IDENTITIES);

export const playerProfileInputSchema = z.object({
  skillLevel: skillLevelSchema,
  preferredPositions: z.array(z.enum(TEAM_POSITION_ROLES)).max(5),
});

export const profileUpdateSchema = z
  .object({
    username: usernameSchema,
    displayName: displayNameSchema,
    photoUrl: z.string().trim().url().max(2000).nullable(),
    bio: z.string().trim().max(280).nullable(),
    identities: z.array(profileIdentitySchema).max(PROFILE_IDENTITIES.length),
    player: playerProfileInputSchema.nullable(),
  })
  .superRefine((input, context) => {
    const isPlayer = input.identities.includes("PLAYER");
    if (isPlayer && !input.player) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["player"],
        message: "Player details are required when Player identity is selected",
      });
    }
    if (!isPlayer && input.player) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["player"],
        message: "Player details are only valid when Player identity is selected",
      });
    }
  });

export const profileResponseSchema = z.object({
  id: z.string(),
  presentation: z.object({
    username: z.string(),
    displayName: z.string(),
    photoUrl: z.string().url().nullable(),
    bio: z.string().nullable(),
  }),
  identities: z.array(profileIdentitySchema),
  player: z
    .object({
      skillLevel: skillLevelSchema,
      preferredPositions: z.array(z.enum(TEAM_POSITION_ROLES)).max(5),
    })
    .nullable(),
});

export type ProfileIdentity = z.infer<typeof profileIdentitySchema>;
export type PlayerProfileInput = z.infer<typeof playerProfileInputSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ProfileResponse = z.infer<typeof profileResponseSchema>;
