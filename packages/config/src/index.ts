import { z } from "zod";

const nodeEnvironmentSchema = z.enum(["development", "test", "production"]);

const apiEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvironmentSchema.default("development"),
  API_PORT: z.coerce.number().int().positive().max(65535).default(3000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  TELEGRAM_ORIGIN: z.string().url().default("http://localhost:5174")
});

export type ApiConfig = z.infer<typeof apiEnvironmentSchema>;

export function loadApiConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  return apiEnvironmentSchema.parse(environment);
}
