import { Router } from "express";
import { pitchReviewTargetSchema } from "@hooma/contracts/pitch";
import {
  appManagerUpdateSchema,
  moderationDecisionSchema,
} from "@hooma/contracts/platform-admin";
import { gamerDisputeResolutionInputSchema, gamerMatchSideSchema } from "@hooma/contracts/gamers";
import { AppError } from "../../../http/errors/app-error.js";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { GamerMatchService } from "../../gamers/application/gamer-match.service.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { PitchModerationService } from "../../pitch/application/pitch-moderation.service.js";
import type { PlaceService } from "../../places/application/place.service.js";
import type { PlatformAdminService } from "../application/platform-admin.service.js";

export function createPlatformAdminRouter(
  service: PlatformAdminService,
  places: PlaceService,
  pitchModeration: PitchModerationService,
  gamerMatches: GamerMatchService,
): Router {
  const router = Router();

  router.get(
    "/access",
    asyncHandler(async (request, response) => {
      response.json(await service.access(getAuth(request).userId));
    }),
  );

  router.get(
    "/overview",
    asyncHandler(async (request, response) => {
      response.json(await service.overview(getAuth(request).userId));
    }),
  );

  router.get(
    "/audit",
    asyncHandler(async (request, response) => {
      const rawLimit = Number(request.query.limit ?? 100);
      response.json(
        await service.audit(getAuth(request).userId, Number.isFinite(rawLimit) ? rawLimit : 100),
      );
    }),
  );

  router.get(
    "/managers",
    asyncHandler(async (request, response) => {
      response.json(await service.managers(getAuth(request).userId));
    }),
  );

  router.put(
    "/managers/:username",
    asyncHandler(async (request, response) => {
      const input = appManagerUpdateSchema.parse(request.body);
      response.json(
        await service.setManagerCapabilities(
          getAuth(request).userId,
          String(request.params.username),
          input.capabilities,
        ),
      );
    }),
  );

  router.get(
    "/queues/places",
    asyncHandler(async (request, response) => {
      const userId = getAuth(request).userId;
      const [placeQueue, pitchPlaceIds] = await Promise.all([
        places.pendingPlaces(userId),
        pitchModeration.pendingInitialPlaceIds(userId),
      ]);
      const pitchOwned = new Set(pitchPlaceIds);
      response.json(placeQueue.filter((item) => !pitchOwned.has(item.place.id)));
    }),
  );
  router.post(
    "/queues/places/:placeId/decision",
    asyncHandler(async (request, response) => {
      const userId = getAuth(request).userId;
      const placeId = String(request.params.placeId);
      const pitchOwned = new Set(await pitchModeration.pendingInitialPlaceIds(userId));
      if (pitchOwned.has(placeId)) {
        throw new AppError(
          409,
          "PLACE_REVIEW_OWNED_BY_PITCH",
          "This pending Place belongs to the Pitch initial-suggestion review workflow",
        );
      }
      response.json(
        await places.reviewPlace(userId, placeId, moderationDecisionSchema.parse(request.body)),
      );
    }),
  );

  router.get(
    "/queues/place-ownership",
    asyncHandler(async (request, response) => {
      response.json(await places.pendingOwnershipClaims(getAuth(request).userId));
    }),
  );
  router.post(
    "/queues/place-ownership/:claimId/decision",
    asyncHandler(async (request, response) => {
      response.json(
        await places.reviewOwnershipClaim(
          getAuth(request).userId,
          String(request.params.claimId),
          moderationDecisionSchema.parse(request.body),
        ),
      );
    }),
  );

  router.get(
    "/queues/pitch",
    asyncHandler(async (request, response) => {
      response.json(await pitchModeration.pending(getAuth(request).userId));
    }),
  );
  router.post(
    "/queues/pitch/:target/:reviewId/decision",
    asyncHandler(async (request, response) => {
      response.json(
        await pitchModeration.review(
          getAuth(request).userId,
          pitchReviewTargetSchema.parse(String(request.params.target)),
          String(request.params.reviewId),
          moderationDecisionSchema.parse(request.body),
        ),
      );
    }),
  );

  router.get(
    "/queues/gamer-disputes",
    asyncHandler(async (request, response) => {
      response.json(await gamerMatches.listDisputes(getAuth(request).userId));
    }),
  );
  router.get(
    "/queues/gamer-disputes/:matchId/proof/:side",
    asyncHandler(async (request, response) => {
      const proof = await gamerMatches.getDisputeProof(
        getAuth(request).userId,
        String(request.params.matchId),
        gamerMatchSideSchema.parse(String(request.params.side).toUpperCase()),
      );
      response.type(proof.contentType).send(Buffer.from(proof.body));
    }),
  );
  router.post(
    "/queues/gamer-disputes/:matchId/resolve",
    asyncHandler(async (request, response) => {
      response.json(
        await gamerMatches.resolveDispute(
          getAuth(request).userId,
          String(request.params.matchId),
          gamerDisputeResolutionInputSchema.parse(request.body),
        ),
      );
    }),
  );

  return router;
}
