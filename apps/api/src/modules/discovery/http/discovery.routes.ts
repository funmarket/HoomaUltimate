import { Router } from "express";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { DiscoveryService } from "../application/discovery.service.js";

export function createDiscoveryPublicRouter(service: DiscoveryService): Router {
  const router = Router();
  router.get(
    "/now",
    asyncHandler(async (req, res) => {
      const requestedLimit = Number(req.query.limit ?? 30);
      const limit = Number.isFinite(requestedLimit) ? requestedLimit : 30;
      res.json(await service.now(new Date(), limit));
    }),
  );
  return router;
}
