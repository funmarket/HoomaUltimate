import { z } from "zod";

const nodeEnvironmentSchema = z.enum(["development", "test", "production"]);
const portSchema = z.coerce.number().int().positive().max(65535);
const optionalUrlSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);
const telegramUserIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Telegram user ID must contain digits only")
  .optional();

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
    SESSION_TTL_HOURS: z.coerce
      .number()
      .int()
      .positive()
      .max(24 * 365)
      .default(720),
    TELEGRAM_BOT_TOKEN: z.string().default(""),
    TELEGRAM_INIT_DATA_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(86400),
    TELEGRAM_LOGIN_CLIENT_ID: z.string().default(""),
    TELEGRAM_LOGIN_CLIENT_SECRET: z.string().default(""),
    TELEGRAM_LOGIN_REDIRECT_URI: optionalUrlSchema,
    PLATFORM_ADMIN_BOOTSTRAP_TELEGRAM_USER_ID: telegramUserIdSchema,
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === "production" && !value.TELEGRAM_BOT_TOKEN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TELEGRAM_BOT_TOKEN"],
        message: "TELEGRAM_BOT_TOKEN is required in production",
      });
    }
    if (value.NODE_ENV === "production" && !value.REDIS_URL) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["REDIS_URL"],
        message: "REDIS_URL is required in production for Whistle transient state",
      });
    }
    const telegramLoginValues = [
      value.TELEGRAM_LOGIN_CLIENT_ID,
      value.TELEGRAM_LOGIN_CLIENT_SECRET,
      value.TELEGRAM_LOGIN_REDIRECT_URI ?? "",
    ];
    const configuredCount = telegramLoginValues.filter(Boolean).length;
    if (configuredCount > 0 && configuredCount < telegramLoginValues.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["TELEGRAM_LOGIN_CLIENT_ID"],
        message:
          "TELEGRAM_LOGIN_CLIENT_ID, TELEGRAM_LOGIN_CLIENT_SECRET and TELEGRAM_LOGIN_REDIRECT_URI must be configured together",
      });
    }
  });

export type ApiConfig = z.infer<typeof apiEnvironmentSchema>;

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  return apiEnvironmentSchema.parse(environment);
}
