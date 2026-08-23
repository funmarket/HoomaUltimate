import { Router } from "express";
import { gamerGameCreateSchema } from "@hooma/contracts/gamers";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { GamerService } from "../application/gamer.service.js";

export function createGamerPublicRouter(service: GamerService): Router {
  const router = Router();
  router.get(
    "/games",
    asyncHandler(async (_req, res) => res.json({ items: await service.listGames() })),
  );
  router.get(
    "/games/:slug",
    asyncHandler(async (req, res) => res.json(await service.getGame(String(req.params.slug)))),
  );
  return router;
}

export function createGamerMemberRouter(service: GamerService): Router {
  const router = Router();
  router.post(
    "/games",
    asyncHandler(async (req, res) => {
      const input = gamerGameCreateSchema.parse(req.body);
      res.status(201).json(await service.addGame(getAuth(req).userId, input));
    }),
  );
  return router;
}
