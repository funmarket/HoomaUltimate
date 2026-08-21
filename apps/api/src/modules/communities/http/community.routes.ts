import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { CommunityService } from "../application/community.service.js";

const coachSchema = z.object({ userId: z.string().min(1) });
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(600).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  houma: z.string().trim().max(100).optional().nullable()
});

export function createCommunityPublicRouter(service: CommunityService): Router {
  const router = Router();
  router.get("/", asyncHandler(async (req, res) => {
    const limit = Number(req.query.limit ?? 30);
    res.json(await service.listPublic(Number.isFinite(limit) ? limit : 30, typeof req.query.cursor === "string" ? req.query.cursor : undefined));
  }));
  router.get("/:id", asyncHandler(async (req, res) => res.json(await service.getPublic(String(req.params.id)))));
  return router;
}

export function createCommunityMemberRouter(service: CommunityService): Router {
  const router = Router();
  router.post("/:id/coaches", asyncHandler(async (req, res) => {
    const input = coachSchema.parse(req.body);
    res.status(201).json(await service.appointCoach(getAuth(req).userId, String(req.params.id), input.userId));
  }));
  router.delete("/:id/coaches/:userId", asyncHandler(async (req, res) => res.json(await service.revokeCoach(getAuth(req).userId, String(req.params.id), String(req.params.userId)))));
  router.post("/", asyncHandler(async (req, res) => res.status(201).json(await service.create(getAuth(req).userId, createSchema.parse(req.body)))));
  return router;
}
