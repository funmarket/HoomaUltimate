import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("api"),
  version: z.string().min(1)
});

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9_.-]+$/);

export const displayNameSchema = z.string().trim().min(2).max(120);

export const registerSchema = z.object({
  loginUsername: usernameSchema,
  password: z.string().min(10).max(128),
  displayUsername: usernameSchema,
  email: z.string().trim().email().max(320).optional().nullable(),
  displayName: displayNameSchema.optional().nullable()
});

export const loginSchema = z.object({
  loginUsername: usernameSchema,
  password: z.string().min(1).max(128)
});

export const sessionResponseSchema = z.object({ ok: z.literal(true) });

export const meResponseSchema = z.object({
  id: z.string(),
  presentation: z.object({
    username: z.string(),
    displayName: z.string(),
    photoUrl: z.string().url().nullable(),
    bio: z.string().nullable()
  }),
  transports: z.array(z.enum(["web", "telegram"])),
  platformRoles: z.array(z.literal("PLATFORM_ADMIN"))
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type MeResponse = z.infer<typeof meResponseSchema>;
