import { z } from "zod";

const nodeEnvironmentSchema = z.enum(["development", "test", "production"]);
const portSchema = z.coerce.number().int().positive().max(65535);

const apiEnvironmentSchema = z
  .object({
    NODE_ENV: nodeEnvironmentSchema.default("development"),
    PORT: portSchema.optional(),
    API_PORT: portSchema.default(3000),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().url().optional(),
    WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
    TELEGRAM_ORIGIN: z.string().url().default("http://localhost:5174"),
    SESSION_COOKIE_NAME: z.string().min(1).default("hooma_session"),
    SESSION_TTL_HOURS: z.coerce.number().int().positive().max(24 * 365).default(720),
    TELEGRAM_BOT_TOKEN: z.string().default(""),
    TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400)
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && !value.TELEGRAM_BOT_TOKEN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TELEGRAM_BOT_TOKEN"],
        message: "TELEGRAM_BOT_TOKEN is required in production"
      });
    }
  });

export type ApiConfig = z.infer<typeof apiEnvironmentSchema>;

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  return apiEnvironmentSchema.parse(environment);
}
