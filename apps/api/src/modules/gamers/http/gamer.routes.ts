import { Router, raw } from "express";
import {
  eaFcRoomCodeInputSchema,
  gamerArenaQuerySchema,
  gamerChallengeCreateSchema,
  gamerGameCreateSchema,
  gamerMatchResultHeadersSchema,
  gamerProfileInputSchema,
} from "@hooma/contracts/gamers";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { GamerMatchService } from "../application/gamer-match.service.js";
import type { GamerService } from "../application/gamer.service.js";

export function createGamerPublicRouter(service: GamerService): Router {
  const router = Router();
  router.get(
    "/games",
    asyncHandler(async (_req, res) => res.json({ items: await service.listGames() })),
  );
  router.get(
    "/discovery",
    asyncHandler(async (_req, res) => res.json({ items: await service.listDiscoverableGamers() })),
  );
  router.get(
    "/arena",
    asyncHandler(async (req, res) => {
      const query = gamerArenaQuerySchema.parse(req.query);
      res.json(await service.listArenaMatches(query.cursor));
    }),
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
  return router;
}

export function createGamerMemberRouter(service: GamerService, matches: GamerMatchService): Router {
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
      res
        .status(201)
        .json(
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
  router.get(
    "/games/:gameId/challenges/:challengeId/match",
    asyncHandler(async (req, res) =>
      res.json(
        await matches.getMatch(
          getAuth(req).userId,
          String(req.params.gameId),
          String(req.params.challengeId),
        ),
      ),
    ),
  );
  router.put(
    "/games/:gameId/challenges/:challengeId/match/code",
    asyncHandler(async (req, res) => {
      const input = eaFcRoomCodeInputSchema.parse(req.body);
      res.json(
        await matches.setRoomCode(
          getAuth(req).userId,
          String(req.params.gameId),
          String(req.params.challengeId),
          input.roomCode,
        ),
      );
    }),
  );
  router.post(
    "/games/:gameId/challenges/:challengeId/match/result",
    raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }),
    asyncHandler(async (req, res) => {
      const scores = gamerMatchResultHeadersSchema.parse({
        yourScore: req.header("x-hooma-your-score"),
        opponentScore: req.header("x-hooma-opponent-score"),
      });
      if (!Buffer.isBuffer(req.body)) {
        res.status(415).json({
          error: { code: "GAMER_MATCH_PROOF_REQUIRED", message: "A match screenshot is required" },
        });
        return;
      }
      res.json(
        await matches.submitResult(
          getAuth(req).userId,
          String(req.params.gameId),
          String(req.params.challengeId),
          {
            ...scores,
            contentType: req.header("content-type") ?? "application/octet-stream",
            proof: new Uint8Array(req.body),
          },
        ),
      );
    }),
  );
  return router;
}
