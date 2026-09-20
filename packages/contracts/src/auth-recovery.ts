import { z } from "zod";
import { usernameSchema } from "./index.js";

export const passwordRecoveryRequestSchema = z.object({
  loginUsername: usernameSchema,
});

export const passwordRecoveryConfirmSchema = z.object({
  loginUsername: usernameSchema,
  code: z.string().trim().min(10).max(11).regex(/^[a-zA-Z0-9-]+$/),
  newPassword: z.string().min(10).max(128),
});

export type PasswordRecoveryRequestInput = z.infer<typeof passwordRecoveryRequestSchema>;
export type PasswordRecoveryConfirmInput = z.infer<typeof passwordRecoveryConfirmSchema>;
