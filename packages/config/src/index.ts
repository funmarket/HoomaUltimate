import { z } from "zod";

const nodeEnvironmentSchema = z.enum(["development", "test", "production"]);
const portSchema = z.coerce.number().int().positive().max(65535);
const telegramUserIdSchema = z
  .string()
  .trim()
  .regex(/^\d+$/, "Telegram user ID must contain digits only")
  .optional();
const objectStorageShape = {
  OBJECT_STORAGE_ENDPOINT: z.string().url().optional(),
  OBJECT_STORAGE_REGION: z.string().min(1).optional(),
  OBJECT_STORAGE_BUCKET: z.string().min(1).optional(),
  OBJECT_STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
  OBJECT_STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
};

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
    PLATFORM_ADMIN_BOOTSTRAP_TELEGRAM_USER_ID: telegramUserIdSchema,
    ...objectStorageShape,
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
    validateCompleteObjectStorageConfig(value, context);
  });

const objectStorageEnvironmentSchema = z
  .object(objectStorageShape)
  .superRefine((value, context) => {
    validateCompleteObjectStorageConfig(value, context);
  });

export type ApiConfig = z.infer<typeof apiEnvironmentSchema>;
export type ObjectStorageConfig = z.infer<typeof objectStorageEnvironmentSchema>;

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  return apiEnvironmentSchema.parse(environment);
}

export function loadObjectStorageConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ObjectStorageConfig {
  return objectStorageEnvironmentSchema.parse(environment);
}

function validateCompleteObjectStorageConfig(
  value: ObjectStorageConfig,
  context: z.RefinementCtx,
): void {
  const storageValues = [
    value.OBJECT_STORAGE_ENDPOINT,
    value.OBJECT_STORAGE_REGION,
    value.OBJECT_STORAGE_BUCKET,
    value.OBJECT_STORAGE_ACCESS_KEY_ID,
    value.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  ];
  const configured = storageValues.filter(Boolean).length;
  if (configured > 0 && configured < storageValues.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["OBJECT_STORAGE_ENDPOINT"],
      message: "Object storage configuration must be provided as a complete set",
    });
  }
}
