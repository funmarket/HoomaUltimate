import { Router } from "express";
import { playPlayerListingInputSchema } from "@hooma/contracts/play";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { PlayService } from "../application/play.service.js";

function numberQuery(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createPlayPublicRouter(service: PlayService): Router {
  const router = Router();
  router.get(
    "/player-listings",
    asyncHandler(async (request, response) => {
      response.json(await service.listPublic(numberQuery(request.query.limit, 30)));
    }),
  );
  return router;
}

export function createPlayMemberRouter(service: PlayService): Router {
  const router = Router();
  router.get(
    "/player-listing",
    asyncHandler(async (request, response) => {
      response.json(await service.getMine(getAuth(request).userId));
    }),
  );
  router.put(
    "/player-listing",
    asyncHandler(async (request, response) => {
      response.json(
        await service.saveMine(
          getAuth(request).userId,
          playPlayerListingInputSchema.parse(request.body),
        ),
      );
    }),
  );
  router.delete(
    "/player-listing",
    asyncHandler(async (request, response) => {
      response.json(await service.removeMine(getAuth(request).userId));
    }),
  );
  return router;
}
