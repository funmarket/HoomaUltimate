import { Router } from "express";
import {
  placeOwnershipClaimSchema,
  placeSuggestionSchema,
  placeUpdateSchema,
} from "@hooma/contracts/places";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { PlaceService } from "../application/place.service.js";

export function createPlacesPublicRouter(service: PlaceService): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (_request, response) => response.json(await service.listPublic())),
  );
  router.get(
    "/:placeId",
    asyncHandler(async (request, response) => {
      response.json(await service.getPublic(String(request.params.placeId)));
    }),
  );
  return router;
}

export function createPlacesMemberRouter(service: PlaceService): Router {
  const router = Router();
  router.post(
    "/",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.suggest(getAuth(request).userId, placeSuggestionSchema.parse(request.body)),
        );
    }),
  );
  router.get(
    "/:placeId/ownership-status",
    asyncHandler(async (request, response) => {
      response.json({
        verified: await service.isVerifiedOwner(
          String(request.params.placeId),
          getAuth(request).userId,
        ),
      });
    }),
  );
  router.get(
    "/:placeId/manage",
    asyncHandler(async (request, response) => {
      response.json(
        await service.getManaged(getAuth(request).userId, String(request.params.placeId)),
      );
    }),
  );
  router.patch(
    "/:placeId",
    asyncHandler(async (request, response) => {
      response.json(
        await service.update(
          getAuth(request).userId,
          String(request.params.placeId),
          placeUpdateSchema.parse(request.body),
        ),
      );
    }),
  );
  router.delete(
    "/:placeId",
    asyncHandler(async (request, response) => {
      response.json(await service.archive(getAuth(request).userId, String(request.params.placeId)));
    }),
  );
  router.post(
    "/:placeId/ownership-claims",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.claimOwnership(
            getAuth(request).userId,
            String(request.params.placeId),
            placeOwnershipClaimSchema.parse(request.body),
          ),
        );
    }),
  );
  return router;
}
