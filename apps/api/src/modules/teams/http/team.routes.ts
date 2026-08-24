import { Router } from "express";
import {
  teamAssistantSchema,
  teamChallengeCreateSchema,
  teamChallengeMessageSchema,
  teamCreateSchema,
  teamLineupSchema,
  teamPlayerSchema,
  teamUpdateSchema
} from "@hooma/contracts";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { TeamService } from "../application/team.service.js";

function numberQuery(value: unknown, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createTeamPublicRouter(service: TeamService): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const city = typeof req.query.city === "string" ? req.query.city : undefined;
      const houma = typeof req.query.houma === "string" ? req.query.houma : undefined;
      res.json(
        await service.listPublic({
          limit: numberQuery(req.query.limit, 30),
          ...(cursor !== undefined ? { cursor } : {}),
          ...(search !== undefined ? { search } : {}),
          ...(city !== undefined ? { city } : {}),
          ...(houma !== undefined ? { houma } : {})
        })
      );
    })
  );
  router.get(
    "/:id",
    asyncHandler(async (req, res) => res.json(await service.getPublic(String(req.params.id))))
  );
  return router;
}

export function createTeamMemberRouter(service: TeamService): Router {
  const router = Router();
  router.get(
    "/mine",
    asyncHandler(async (req, res) => res.json(await service.myTeams(getAuth(req).userId)))
  );
  router.get(
    "/managed",
    asyncHandler(async (req, res) => res.json(await service.managedTeams(getAuth(req).userId)))
  );
  router.get(
    "/challenges/incoming",
    asyncHandler(async (req, res) => res.json(await service.incoming(getAuth(req).userId, numberQuery(req.query.limit, 30))))
  );
  router.get(
    "/challenges/outgoing",
    asyncHandler(async (req, res) => res.json(await service.outgoing(getAuth(req).userId, numberQuery(req.query.limit, 30))))
  );
  router.get(
    "/challenges/:challengeId/messages",
    asyncHandler(async (req, res) =>
      res.json(await service.messages(getAuth(req).userId, String(req.params.challengeId)))
    )
  );
  router.post(
    "/challenges/:challengeId/messages",
    asyncHandler(async (req, res) => {
      const input = teamChallengeMessageSchema.parse(req.body);
      res
        .status(201)
        .json(await service.createMessage(getAuth(req).userId, String(req.params.challengeId), input.body));
    })
  );
  router.post(
    "/challenges/:challengeId/accept",
    asyncHandler(async (req, res) => res.json(await service.accept(getAuth(req).userId, String(req.params.challengeId))))
  );
  router.post(
    "/challenges/:challengeId/decline",
    asyncHandler(async (req, res) => res.json(await service.decline(getAuth(req).userId, String(req.params.challengeId))))
  );
  router.post(
    "/challenges/:challengeId/cancel",
    asyncHandler(async (req, res) => res.json(await service.cancel(getAuth(req).userId, String(req.params.challengeId))))
  );
  router.get(
    "/challenges/:challengeId",
    asyncHandler(async (req, res) => res.json(await service.challenge(getAuth(req).userId, String(req.params.challengeId))))
  );
  router.post(
    "/challenges",
    asyncHandler(async (req, res) =>
      res
        .status(201)
        .json(await service.createChallenge(getAuth(req).userId, teamChallengeCreateSchema.parse(req.body)))
    )
  );
  router.get(
    "/games/:gameId",
    asyncHandler(async (req, res) => res.json(await service.game(getAuth(req).userId, String(req.params.gameId))))
  );
  router.get(
    "/games",
    asyncHandler(async (req, res) => res.json(await service.games(getAuth(req).userId, numberQuery(req.query.limit, 30))))
  );
  router.post(
    "/:teamId/players",
    asyncHandler(async (req, res) => {
      const input = teamPlayerSchema.parse(req.body);
      res.status(201).json(await service.addPlayer(getAuth(req).userId, String(req.params.teamId), input.userId));
    })
  );
  router.delete(
    "/:teamId/players/:userId",
    asyncHandler(async (req, res) =>
      res.json(
        await service.removePlayer(getAuth(req).userId, String(req.params.teamId), String(req.params.userId))
      )
    )
  );
  router.post(
    "/:teamId/assistants",
    asyncHandler(async (req, res) => {
      const input = teamAssistantSchema.parse(req.body);
      res
        .status(201)
        .json(
          await service.assignAssistant(
            getAuth(req).userId,
            String(req.params.teamId),
            input.userId,
            input.capabilities
          )
        );
    })
  );
  router.delete(
    "/:teamId/assistants/:userId",
    asyncHandler(async (req, res) =>
      res.json(
        await service.revokeAssistant(
          getAuth(req).userId,
          String(req.params.teamId),
          String(req.params.userId)
        )
      )
    )
  );
  router.get(
    "/:teamId/lineups/current",
    asyncHandler(async (req, res) =>
      res.json(await service.currentLineup(getAuth(req).userId, String(req.params.teamId)))
    )
  );
  router.put(
    "/:teamId/lineups/current",
    asyncHandler(async (req, res) =>
      res.json(
        await service.saveCurrentLineup(
          getAuth(req).userId,
          String(req.params.teamId),
          teamLineupSchema.parse(req.body)
        )
      )
    )
  );
  router.patch(
    "/:teamId",
    asyncHandler(async (req, res) =>
      res.json(
        await service.update(getAuth(req).userId, String(req.params.teamId), teamUpdateSchema.parse(req.body))
      )
    )
  );
  router.post(
    "/",
    asyncHandler(async (req, res) =>
      res.status(201).json(await service.create(getAuth(req).userId, teamCreateSchema.parse(req.body)))
    )
  );
  return router;
}
