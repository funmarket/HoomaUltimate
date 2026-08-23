import { Router } from "express";
import {
  gamerChallengeCreateSchema,
  gamerGameCreateSchema,
  gamerProfileInputSchema,
} from "@hooma/contracts/gamers";
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
  router.get(
    "/games/:gameId/challengers",
    asyncHandler(async (req, res) =>
      res.json({ items: await service.listChallengers(String(req.params.gameId)) }),
    ),
  );
  router.get(
    "/games/:gameId/profiles/:profileId",
    asyncHandler(async (req, res) =>
      res.json(
        await service.getPublicProfile(String(req.params.gameId), String(req.params.profileId)),
      ),
    ),
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
  router.get(
    "/games/:gameId/profile",
    asyncHandler(async (req, res) =>
      res.json(await service.getMyProfile(getAuth(req).userId, String(req.params.gameId))),
    ),
  );
  router.put(
    "/games/:gameId/profile",
    asyncHandler(async (req, res) => {
      const input = gamerProfileInputSchema.parse(req.body);
      res.json(
        await service.upsertMyProfile(getAuth(req).userId, String(req.params.gameId), input),
      );
    }),
  );
  router.post(
    "/games/:gameId/challenges",
    asyncHandler(async (req, res) => {
      const input = gamerChallengeCreateSchema.parse(req.body);
      res.status(201).json(
        await service.createChallenge(
          getAuth(req).userId,
          String(req.params.gameId),
          input.challengedProfileId,
        ),
      );
    }),
  );
  router.get(
    "/games/:gameId/challenges",
    asyncHandler(async (req, res) =>
      res.json({
        items: await service.listMyChallenges(getAuth(req).userId, String(req.params.gameId)),
      }),
    ),
  );
  router.post(
    "/games/:gameId/challenges/:challengeId/accept",
    asyncHandler(async (req, res) =>
      res.json(
        await service.acceptChallenge(
          getAuth(req).userId,
          String(req.params.gameId),
          String(req.params.challengeId),
        ),
      ),
    ),
  );
  router.post(
    "/games/:gameId/challenges/:challengeId/decline",
    asyncHandler(async (req, res) =>
      res.json(
        await service.declineChallenge(
          getAuth(req).userId,
          String(req.params.gameId),
          String(req.params.challengeId),
        ),
      ),
    ),
  );
  router.post(
    "/games/:gameId/challenges/:challengeId/cancel",
    asyncHandler(async (req, res) =>
      res.json(
        await service.cancelChallenge(
          getAuth(req).userId,
          String(req.params.gameId),
          String(req.params.challengeId),
        ),
      ),
    ),
  );
  return router;
}
