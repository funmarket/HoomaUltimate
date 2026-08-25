import {
  communityCreateSchema,
  communityMemberAddSchema,
  communityUpdateSchema,
} from "@hooma/contracts/communities";
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { CommunityService } from "../application/community.service.js";

const coachSchema = z.object({ userId: z.string().min(1) });

function definedCommunityFields(parsed: z.infer<typeof communityUpdateSchema>) {
  return {
    ...(parsed.name !== undefined ? { name: parsed.name } : {}),
    ...(parsed.description !== undefined ? { description: parsed.description } : {}),
    ...(parsed.city !== undefined ? { city: parsed.city } : {}),
    ...(parsed.houma !== undefined ? { houma: parsed.houma } : {}),
    ...(parsed.logoUrl !== undefined ? { logoUrl: parsed.logoUrl } : {}),
    ...(parsed.bannerUrl !== undefined ? { bannerUrl: parsed.bannerUrl } : {}),
    ...(parsed.visibility !== undefined ? { visibility: parsed.visibility } : {}),
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
      const result = await service.join(getAuth(req).userId, String(req.params.id));
      res.status(result.status === "PENDING" ? 202 : 201).json(result);
    }),
  );
  router.get(
    "/:id/join-request",
    asyncHandler(async (req, res) => {
      res.json(await service.myJoinRequest(getAuth(req).userId, String(req.params.id)));
    }),
  );
  router.delete(
    "/:id/join-request",
    asyncHandler(async (req, res) => {
      res.json(await service.cancelJoinRequest(getAuth(req).userId, String(req.params.id)));
    }),
  );
  router.get(
    "/:id/join-requests",
    asyncHandler(async (req, res) => {
      res.json(await service.joinRequests(getAuth(req).userId, String(req.params.id)));
    }),
  );
  router.post(
    "/:id/join-requests/:userId/approve",
    asyncHandler(async (req, res) => {
      res.json(
        await service.approveJoinRequest(
          getAuth(req).userId,
          String(req.params.id),
          String(req.params.userId),
        ),
      );
    }),
  );
  router.post(
    "/:id/join-requests/:userId/decline",
    asyncHandler(async (req, res) => {
      res.json(
        await service.declineJoinRequest(
          getAuth(req).userId,
          String(req.params.id),
          String(req.params.userId),
        ),
      );
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
  router.post(
    "/:id/members",
    asyncHandler(async (req, res) => {
      const input = communityMemberAddSchema.parse(req.body);
      res
        .status(201)
        .json(await service.addMember(getAuth(req).userId, String(req.params.id), input.username));
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
      const input = definedCommunityFields(communityUpdateSchema.parse(req.body));
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
      const parsed = communityCreateSchema.parse(req.body);
      const input = { name: parsed.name, ...definedCommunityFields(parsed) };
      res.status(201).json(await service.create(getAuth(req).userId, input));
    }),
  );
  return router;
}
