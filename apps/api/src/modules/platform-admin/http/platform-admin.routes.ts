import { Router } from "express";
import {
  appManagerUpdateSchema,
  moderationDecisionSchema,
} from "@hooma/contracts/platform-management";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { PlaceCapabilityService } from "../../places/application/place-capability.service.js";
import type { PlaceService } from "../../places/application/place.service.js";
import type { PlatformAdminService } from "../application/platform-admin.service.js";

export function createPlatformAdminRouter(
  service: PlatformAdminService,
  places: PlaceService,
  watch: PlaceCapabilityService,
  pitch: PlaceCapabilityService,
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
      response.json(await places.pendingPlaces(getAuth(request).userId));
    }),
  );
  router.post(
    "/queues/places/:placeId/decision",
    asyncHandler(async (request, response) => {
      response.json(
        await places.reviewPlace(
          getAuth(request).userId,
          String(request.params.placeId),
          moderationDecisionSchema.parse(request.body),
        ),
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
    "/queues/watch",
    asyncHandler(async (request, response) => {
      response.json(await watch.pending(getAuth(request).userId));
    }),
  );
  router.post(
    "/queues/watch/:applicationId/decision",
    asyncHandler(async (request, response) => {
      response.json(
        await watch.review(
          getAuth(request).userId,
          String(request.params.applicationId),
          moderationDecisionSchema.parse(request.body),
        ),
      );
    }),
  );

  router.get(
    "/queues/pitch",
    asyncHandler(async (request, response) => {
      response.json(await pitch.pending(getAuth(request).userId));
    }),
  );
  router.post(
    "/queues/pitch/:applicationId/decision",
    asyncHandler(async (request, response) => {
      response.json(
        await pitch.review(
          getAuth(request).userId,
          String(request.params.applicationId),
          moderationDecisionSchema.parse(request.body),
        ),
      );
    }),
  );

  return router;
}
