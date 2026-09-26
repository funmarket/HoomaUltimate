import { Buffer } from "node:buffer";
import { Router, raw } from "express";
import {
  placeExternalImageInputSchema,
  placeImageOrderSchema,
  placeOwnershipClaimSchema,
  placeSuggestionSchema,
  placeUpdateSchema,
} from "@hooma/contracts/places";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { PlaceMediaService } from "../application/place-media.service.js";
import type { PlaceService } from "../application/place.service.js";

export function createPlacesPublicRouter(service: PlaceService, media: PlaceMediaService): Router {
  const router = Router();
  router.get(
    "/:placeId/images/:imageId/content",
    asyncHandler(async (request, response) => {
      response.setHeader("cache-control", "private, no-store");
      response.redirect(
        302,
        await media.deliveryUrlPublic(
          String(request.params.placeId),
          String(request.params.imageId),
        ),
      );
    }),
  );
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

export function createPlacesMemberRouter(service: PlaceService, media: PlaceMediaService): Router {
  const router = Router();
  router.post(
    "/:placeId/images/external",
    asyncHandler(async (request, response) => {
      response.status(201).json(
        await media.addExternal(
          getAuth(request).userId,
          String(request.params.placeId),
          placeExternalImageInputSchema.parse(request.body),
        ),
      );
    }),
  );
  router.post(
    "/:placeId/images/upload",
    raw({ type: "*/*", limit: "5mb" }),
    asyncHandler(async (request, response) => {
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      response.status(201).json(
        await media.addUpload(getAuth(request).userId, String(request.params.placeId), {
          contentType: request.get("content-type") ?? "",
          body,
        }),
      );
    }),
  );
  router.put(
    "/:placeId/images/order",
    asyncHandler(async (request, response) => {
      response.json(
        await media.reorder(
          getAuth(request).userId,
          String(request.params.placeId),
          placeImageOrderSchema.parse(request.body),
        ),
      );
    }),
  );
  router.delete(
    "/:placeId/images/:imageId",
    asyncHandler(async (request, response) => {
      response.json(
        await media.delete(
          getAuth(request).userId,
          String(request.params.placeId),
          String(request.params.imageId),
        ),
      );
    }),
  );
  router.post(
    "/",
    asyncHandler(async (request, response) => {
      const result = await service.suggest(
        getAuth(request).userId,
        placeSuggestionSchema.parse(request.body),
      );
      response.status(result.outcome === "CREATED" ? 201 : 200).json(result);
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
