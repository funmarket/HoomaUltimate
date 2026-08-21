import { Router } from "express";
import type { HealthResponse } from "@hooma/contracts";

export function createHealthRouter(): Router {
  const router = Router();

  router.get("/health", (_request, response) => {
    const body: HealthResponse = {
      status: "ok",
      service: "api",
      version: process.env.npm_package_version ?? "0.1.0"
    };
    response.status(200).json(body);
  });

  return router;
}
