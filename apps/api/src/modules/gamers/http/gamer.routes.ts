import { Router } from "express";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { GamerService } from "../application/gamer.service.js";

export function createGamerPublicRouter(service: GamerService): Router {
  const router = Router();
  router.get("/games", asyncHandler(async (_req, res) => res.json({ items: await service.listGames() })));
  router.get("/games/:slug", asyncHandler(async (req, res) => res.json(await service.getGame(String(req.params.slug)))));
  return router;
}
