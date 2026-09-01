import { Router } from "express";
import {
  playEventInviteInputSchema,
  playPlayerListingInputSchema,
  playTeamOfferInputSchema,
} from "@hooma/contracts/play";
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
    "/open-matches",
    asyncHandler(async (request, response) => {
      const cursor = typeof request.query.cursor === "string" ? request.query.cursor : undefined;
      response.json(await service.openMatches(numberQuery(request.query.limit, 50), cursor));
    }),
  );
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
  router.get(
    "/player-actions",
    asyncHandler(async (request, response) => {
      response.json(await service.actionState(getAuth(request).userId));
    }),
  );
  router.get(
    "/managed-events",
    asyncHandler(async (request, response) => {
      response.json(await service.managedPlayEvents(getAuth(request).userId));
    }),
  );
  router.post(
    "/player-listings/:listingId/team-offer",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.sendTeamOffer(
            getAuth(request).userId,
            String(request.params.listingId),
            playTeamOfferInputSchema.parse(request.body),
          ),
        );
    }),
  );
  router.post(
    "/player-listings/:listingId/event-invite",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.sendEventInvite(
            getAuth(request).userId,
            String(request.params.listingId),
            playEventInviteInputSchema.parse(request.body),
          ),
        );
    }),
  );
  return router;
}
