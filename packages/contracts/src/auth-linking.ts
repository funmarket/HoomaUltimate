import { z } from "zod";

export const webCredentialAttachSchema = z.object({
  loginUsername: z
    .string()
    .trim()
    .min(3)
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/),
  password: z.string().min(10).max(128),
  email: z.string().trim().email().max(320).optional().nullable(),
});

export const telegramOidcStartSchema = z.object({
  returnTo: z.string().trim().max(2048).optional().default("/"),
});

export const telegramOidcStartResponseSchema = z.object({
  enabled: z.boolean(),
  authorizationUrl: z.string().url().nullable(),
});

export const loginMethodsResponseSchema = z.object({
  web: z
    .object({
      loginUsername: z.string(),
      email: z.string().email().nullable(),
    })
    .nullable(),
  telegram: z
    .object({
      username: z.string().nullable(),
    })
    .nullable(),
});

export type WebCredentialAttachInput = z.infer<typeof webCredentialAttachSchema>;
export type TelegramOidcStartInput = z.infer<typeof telegramOidcStartSchema>;
export type TelegramOidcStartResponse = z.infer<typeof telegramOidcStartResponseSchema>;
export type LoginMethodsResponse = z.infer<typeof loginMethodsResponseSchema>;
