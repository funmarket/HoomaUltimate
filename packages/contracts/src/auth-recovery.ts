import { z } from "zod";
import { usernameSchema } from "./index.js";

export const passwordRecoveryRequestSchema = z.object({
  loginUsername: usernameSchema,
});

export const passwordRecoveryConfirmSchema = z.object({
  loginUsername: usernameSchema,
  code: z
    .string()
    .trim()
    .min(10)
    .max(11)
    .regex(/^[a-zA-Z0-9-]+$/),
  newPassword: z.string().min(10).max(128),
});

export type PasswordRecoveryRequestInput = z.infer<typeof passwordRecoveryRequestSchema>;
export type PasswordRecoveryConfirmInput = z.infer<typeof passwordRecoveryConfirmSchema>;

export const passwordRecoveryCodeResponseSchema = z.object({
  loginUsername: usernameSchema,
  code: z.string().regex(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/),
  expiresAt: z.string().datetime(),
});

export type PasswordRecoveryCodeResponse = z.infer<typeof passwordRecoveryCodeResponseSchema>;
