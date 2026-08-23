import { Router } from "express";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { GamerService } from "../application/gamer.service.js";

/**
 * Public privacy-safe Gamers discovery router.
 *
 * It is not mounted during G0 because the persisted catalog does not exist yet.
 * G1 mounts this under the canonical /api/public/v1 Gamers namespace after the
 * Prisma repository is real; protected mutations stay under /api/v1.
 */
export function createGamerPublicRouter(service: GamerService): Router {
  const router = Router();
  router.get("/games", asyncHandler(async (_req, res) => res.json({ items: await service.listGames() })));
  router.get("/games/:slug", asyncHandler(async (req, res) => res.json(await service.getGame(String(req.params.slug)))));
  return router;
}
