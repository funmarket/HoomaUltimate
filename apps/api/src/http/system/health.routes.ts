import { Router } from "express";
import type { HealthResponse } from "@hooma/contracts";
import type { ReadinessService } from "../../modules/system/application/readiness.service.js";

function liveResponse(): HealthResponse {
  return {
    status: "ok",
    service: "api",
    version: process.env.npm_package_version ?? "0.1.0",
  };
}

export function createHealthRouter(readiness: ReadinessService): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    response.status(200).json(liveResponse());
  });

  router.get("/health/live", (_request, response) => {
    response.status(200).json(liveResponse());
  });

  router.get("/health/ready", async (_request, response) => {
    const result = await readiness.check();
    response.status(result.status === "ok" ? 200 : 503).json({
      ...liveResponse(),
      status: result.status,
      checks: result.checks,
    });
  });

  return router;
}
