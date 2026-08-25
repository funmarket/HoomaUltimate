import { z } from "zod";
import { usernameSchema } from "./index.js";

export const webCredentialAttachSchema = z.object({
  loginUsername: usernameSchema,
  password: z.string().min(10).max(128),
  email: z.string().trim().email().max(320).optional().nullable(),
});

export const telegramLinkClaimSchema = z.object({
  loginUsername: usernameSchema,
  code: z
    .string()
    .trim()
    .length(16)
    .regex(/^[A-Za-z0-9_-]+$/),
});

export const loginMethodsResponseSchema = z.object({
  web: z
    .object({
      loginUsername: z.string(),
      email: z.string().nullable(),
    })
    .nullable(),
  telegram: z
    .object({
      username: z.string().nullable(),
    })
    .nullable(),
});

export const telegramLinkCodeResponseSchema = z.object({
  loginUsername: z.string(),
  code: z.string(),
  expiresAt: z.string().datetime(),
});

export type WebCredentialAttachInput = z.infer<typeof webCredentialAttachSchema>;
export type TelegramLinkClaimInput = z.infer<typeof telegramLinkClaimSchema>;
export type LoginMethodsResponse = z.infer<typeof loginMethodsResponseSchema>;
export type TelegramLinkCodeResponse = z.infer<typeof telegramLinkCodeResponseSchema>;
