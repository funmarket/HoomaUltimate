import { z } from "zod";
import { usernameSchema } from "./index.js";

export const webCredentialAttachSchema = z.object({
  loginUsername: usernameSchema,
  password: z.string().min(10).max(128),
  email: z.string().trim().email().max(320).optional().nullable(),
});

export const telegramLinkCodeSchema = z.object({
  code: z.string().trim().min(12).max(64),
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

export const telegramLinkIntentResponseSchema = z.object({
  code: z.string(),
  expiresAt: z.string().datetime(),
});

export type WebCredentialAttachInput = z.infer<typeof webCredentialAttachSchema>;
export type TelegramLinkCodeInput = z.infer<typeof telegramLinkCodeSchema>;
export type LoginMethodsResponse = z.infer<typeof loginMethodsResponseSchema>;
export type TelegramLinkIntentResponse = z.infer<typeof telegramLinkIntentResponseSchema>;
