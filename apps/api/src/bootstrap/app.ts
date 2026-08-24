import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "./container.js";
import { createHealthRouter } from "../http/system/health.routes.js";
import { createPublicV1Router } from "../http/public-v1/router.js";
import { createMemberV1Router } from "../http/v1/router.js";
import { errorHandler } from "../http/errors/error-handler.js";

export function createApp(config: ApiConfig, container: AppContainer) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: [config.WEB_ORIGIN, config.TELEGRAM_ORIGIN],
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(createHealthRouter());
  app.use("/api/public/v1", createPublicV1Router(container, config));
  app.use("/api/v1", createMemberV1Router(container, config));
  app.use(errorHandler);
  return app;
}
