import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "./container.js";
import { createHealthRouter } from "../http/system/health.routes.js";
import { createPublicV1Router } from "../http/public-v1/router.js";
import { createMemberV1Router } from "../http/v1/router.js";
import { errorHandler } from "../http/errors/error-handler.js";
import { createApiRateLimitMiddleware } from "../http/rate-limit/api-rate-limit.middleware.js";

export function createApp(config: ApiConfig, container: AppContainer) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.API_TRUST_PROXY_HOPS);
  app.use(helmet());
  app.use(
    cors({
      origin: [config.WEB_ORIGIN, config.TELEGRAM_ORIGIN],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(createHealthRouter(container.readinessService));
  app.use(
    "/api/public/v1",
    createApiRateLimitMiddleware(container.apiRateLimiter, { bucket: "public" }),
  );
  app.use("/api/public/v1", createPublicV1Router(container, config));
  app.use(
    "/api/v1",
    createApiRateLimitMiddleware(container.apiRateLimiter, { bucket: "member-preauth" }),
  );
  app.use("/api/v1", createMemberV1Router(container, config));
  app.use(errorHandler);
  return app;
}
