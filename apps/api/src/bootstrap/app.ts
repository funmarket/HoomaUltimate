import cors from "cors";
import express from "express";
import helmet from "helmet";
import type { ApiConfig } from "@hooma/config";
import { createHealthRouter } from "../http/system/health.routes.js";

export function createApp(config: ApiConfig) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: [config.WEB_ORIGIN, config.TELEGRAM_ORIGIN],
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(createHealthRouter());
  return app;
}
