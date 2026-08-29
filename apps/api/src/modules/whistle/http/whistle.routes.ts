import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { WhistleService } from "../application/whistle.service.js";
import type { WhistleContextType } from "../application/whistle.repository.js";

const contextSchema = z.enum(["COMMUNITY", "EVENT", "TEAM", "RIDE", "ULTRAS", "GAMER_SQUAD"]);
const createSchema = z.object({ body: z.string().min(1) });

export function createWhistleRouter(service: WhistleService): Router {
  const router = Router();

  router.get(
    "/users/:username",
    asyncHandler(async (req, res) => {
      res.json(await service.listDirectUser(getAuth(req).userId, String(req.params.username)));
    }),
  );

  router.post(
    "/users/:username",
    asyncHandler(async (req, res) => {
      const input = createSchema.parse(req.body);
      res
        .status(201)
        .json(
          await service.createDirectUser(
            getAuth(req).userId,
            String(req.params.username),
            input.body,
          ),
        );
    }),
  );

  router.get(
    "/gamers/:profileId",
    asyncHandler(async (req, res) => {
      res.json(await service.listDirectGamer(getAuth(req).userId, String(req.params.profileId)));
    }),
  );

  router.post(
    "/gamers/:profileId",
    asyncHandler(async (req, res) => {
      const input = createSchema.parse(req.body);
      res
        .status(201)
        .json(
          await service.createDirectGamer(
            getAuth(req).userId,
            String(req.params.profileId),
            input.body,
          ),
        );
    }),
  );

  router.get(
    "/contexts/:contextType/:contextId",
    asyncHandler(async (req, res) => {
      const contextType = contextSchema.parse(req.params.contextType) as WhistleContextType;
      res.json(await service.list(getAuth(req).userId, contextType, String(req.params.contextId)));
    }),
  );

  router.post(
    "/contexts/:contextType/:contextId",
    asyncHandler(async (req, res) => {
      const contextType = contextSchema.parse(req.params.contextType) as WhistleContextType;
      const input = createSchema.parse(req.body);
      res
        .status(201)
        .json(
          await service.create(
            getAuth(req).userId,
            contextType,
            String(req.params.contextId),
            input.body,
          ),
        );
    }),
  );

  return router;
}
