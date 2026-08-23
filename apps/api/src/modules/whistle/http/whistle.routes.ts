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

  router.get("/contexts/:contextType/:contextId", asyncHandler(async (req, res) => {
    const contextType = contextSchema.parse(req.params.contextType) as WhistleContextType;
    res.json(await service.list(getAuth(req).userId, contextType, String(req.params.contextId)));
  }));

  router.post("/contexts/:contextType/:contextId", asyncHandler(async (req, res) => {
    const contextType = contextSchema.parse(req.params.contextType) as WhistleContextType;
    const input = createSchema.parse(req.body);
    res.status(201).json(await service.create(getAuth(req).userId, contextType, String(req.params.contextId), input.body));
  }));

  return router;
}
