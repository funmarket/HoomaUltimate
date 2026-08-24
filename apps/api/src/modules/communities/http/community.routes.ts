import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { CommunityService } from "../application/community.service.js";

const coachSchema = z.object({ userId: z.string().min(1) });
const optionalUrl = z.string().trim().url().max(2000).optional().nullable();
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(600).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  houma: z.string().trim().max(100).optional().nullable(),
  logoUrl: optionalUrl,
  bannerUrl: optionalUrl,
});
const updateSchema = createSchema.partial();

function definedCommunityFields(parsed: z.infer<typeof updateSchema>) {
  return {
    ...(parsed.name !== undefined ? { name: parsed.name } : {}),
    ...(parsed.description !== undefined ? { description: parsed.description } : {}),
    ...(parsed.city !== undefined ? { city: parsed.city } : {}),
    ...(parsed.houma !== undefined ? { houma: parsed.houma } : {}),
    ...(parsed.logoUrl !== undefined ? { logoUrl: parsed.logoUrl } : {}),
    ...(parsed.bannerUrl !== undefined ? { bannerUrl: parsed.bannerUrl } : {}),
  };
}

export function createCommunityPublicRouter(service: CommunityService): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const limit = Number(req.query.limit ?? 30);
      res.json(
        await service.listPublic(
          Number.isFinite(limit) ? limit : 30,
          typeof req.query.cursor === "string" ? req.query.cursor : undefined,
        ),
      );
    }),
  );
  router.get(
    "/:id",
    asyncHandler(async (req, res) => res.json(await service.getPublic(String(req.params.id)))),
  );
  return router;
}

export function createCommunityMemberRouter(service: CommunityService): Router {
  const router = Router();

  router.post(
    "/:id/join",
    asyncHandler(async (req, res) => {
      res.status(201).json(await service.join(getAuth(req).userId, String(req.params.id)));
    }),
  );
  router.delete(
    "/:id/membership",
    asyncHandler(async (req, res) => {
      res.json(await service.leave(getAuth(req).userId, String(req.params.id)));
    }),
  );
  router.get(
    "/:id/members",
    asyncHandler(async (req, res) => {
      res.json(await service.members(getAuth(req).userId, String(req.params.id)));
    }),
  );
  router.delete(
    "/:id/members/:userId",
    asyncHandler(async (req, res) => {
      res.json(
        await service.removeMember(
          getAuth(req).userId,
          String(req.params.id),
          String(req.params.userId),
        ),
      );
    }),
  );
  router.post(
    "/:id/coaches",
    asyncHandler(async (req, res) => {
      const input = coachSchema.parse(req.body);
      res
        .status(201)
        .json(await service.appointCoach(getAuth(req).userId, String(req.params.id), input.userId));
    }),
  );
  router.delete(
    "/:id/coaches/:userId",
    asyncHandler(async (req, res) => {
      res.json(
        await service.revokeCoach(
          getAuth(req).userId,
          String(req.params.id),
          String(req.params.userId),
        ),
      );
    }),
  );
  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      const input = definedCommunityFields(updateSchema.parse(req.body));
      res.json(await service.update(getAuth(req).userId, String(req.params.id), input));
    }),
  );
  router.delete(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await service.archive(getAuth(req).userId, String(req.params.id)));
    }),
  );
  router.post(
    "/",
    asyncHandler(async (req, res) => {
      const parsed = createSchema.parse(req.body);
      const input = { name: parsed.name, ...definedCommunityFields(parsed) };
      res.status(201).json(await service.create(getAuth(req).userId, input));
    }),
  );
  return router;
}
