import { Router } from "express";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { PlatformAdminService } from "../application/platform-admin.service.js";

export function createPlatformAdminRouter(service: PlatformAdminService): Router {
  const router = Router();

  router.get(
    "/overview",
    asyncHandler(async (request, response) => {
      response.json(await service.overview(getAuth(request).userId));
    })
  );

  router.get(
    "/audit",
    asyncHandler(async (request, response) => {
      const rawLimit = Number(request.query.limit ?? 100);
      response.json(await service.audit(getAuth(request).userId, Number.isFinite(rawLimit) ? rawLimit : 100));
    })
  );

  return router;
}
