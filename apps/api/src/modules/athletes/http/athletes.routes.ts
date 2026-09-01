import {
  athletesCommunityCreateSchema,
  athletesCommunityUpdateSchema,
  athletesListQuerySchema,
  athletesMemberAddSchema,
  athletesMemberRoleUpdateSchema,
} from "@hooma/contracts/athletes";
import { Router } from "express";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { AthletesService } from "../application/athletes.service.js";

export function createAthletesPublicRouter(service: AthletesService): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const query = athletesListQuerySchema.parse(req.query);
      res.json(
        await service.listPublic({
          limit: query.limit,
          ...(query.sport !== undefined ? { sport: query.sport } : {}),
          ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
        }),
      );
    }),
  );
  router.get(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(await service.getPublic(String(req.params.id)));
    }),
  );
  return router;
}

export function createAthletesMemberRouter(service: AthletesService): Router {
  const router = Router();
  router.post(
    "/",
    asyncHandler(async (req, res) => {
      res
        .status(201)
        .json(
          await service.create(getAuth(req).userId, athletesCommunityCreateSchema.parse(req.body)),
        );
    }),
  );
  router.get(
    "/:id",
    asyncHandler(async (req, res) =>
      res.json(await service.getPublic(String(req.params.id), getAuth(req).userId)),
    ),
  );
  router.patch(
    "/:id",
    asyncHandler(async (req, res) => {
      res.json(
        await service.update(
          getAuth(req).userId,
          String(req.params.id),
          athletesCommunityUpdateSchema.parse(req.body),
        ),
      );
    }),
  );
  router.delete(
    "/:id",
    asyncHandler(async (req, res) =>
      res.json(await service.archive(getAuth(req).userId, String(req.params.id))),
    ),
  );
  router.post(
    "/:id/join",
    asyncHandler(async (req, res) => {
      const result = await service.join(getAuth(req).userId, String(req.params.id));
      res.status(result.status === "PENDING" ? 202 : 201).json(result);
    }),
  );
  router.get(
    "/:id/join-request",
    asyncHandler(async (req, res) =>
      res.json(await service.myJoinRequest(getAuth(req).userId, String(req.params.id))),
    ),
  );
  router.delete(
    "/:id/join-request",
    asyncHandler(async (req, res) =>
      res.json(await service.cancelJoinRequest(getAuth(req).userId, String(req.params.id))),
    ),
  );
  router.get(
    "/:id/join-requests",
    asyncHandler(async (req, res) =>
      res.json(await service.joinRequests(getAuth(req).userId, String(req.params.id))),
    ),
  );
  router.post(
    "/:id/join-requests/:userId/approve",
    asyncHandler(async (req, res) =>
      res.json(
        await service.approveJoinRequest(
          getAuth(req).userId,
          String(req.params.id),
          String(req.params.userId),
        ),
      ),
    ),
  );
  router.post(
    "/:id/join-requests/:userId/decline",
    asyncHandler(async (req, res) =>
      res.json(
        await service.declineJoinRequest(
          getAuth(req).userId,
          String(req.params.id),
          String(req.params.userId),
        ),
      ),
    ),
  );
  router.get(
    "/:id/members",
    asyncHandler(async (req, res) =>
      res.json(await service.members(getAuth(req).userId, String(req.params.id))),
    ),
  );
  router.post(
    "/:id/members",
    asyncHandler(async (req, res) => {
      const input = athletesMemberAddSchema.parse(req.body);
      res
        .status(201)
        .json(await service.addMember(getAuth(req).userId, String(req.params.id), input.username));
    }),
  );
  router.delete(
    "/:id/members/:userId",
    asyncHandler(async (req, res) =>
      res.json(
        await service.removeMember(
          getAuth(req).userId,
          String(req.params.id),
          String(req.params.userId),
        ),
      ),
    ),
  );
  router.patch(
    "/:id/members/:userId/role",
    asyncHandler(async (req, res) => {
      const input = athletesMemberRoleUpdateSchema.parse(req.body);
      res.json(
        await service.setRole(
          getAuth(req).userId,
          String(req.params.id),
          String(req.params.userId),
          input.role,
        ),
      );
    }),
  );
  return router;
}
