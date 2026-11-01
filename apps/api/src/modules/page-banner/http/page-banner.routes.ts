import { Buffer } from "node:buffer";
import { Router, raw } from "express";
import {
  pageBannerPlacementToggleSchema,
  pageBannerReorderSchema,
} from "@hooma/contracts/page-banner";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import { PageBannerService, parsePageBannerMetadata } from "../application/page-banner.service.js";

export function createPageBannerAdminRouter(service: PageBannerService): Router {
  const router = Router();
  router.get(
    "/banners",
    asyncHandler(async (request, response) =>
      response.json(await service.adminList(getAuth(request).userId)),
    ),
  );
  router.get(
    "/banners/:placementId",
    asyncHandler(async (request, response) =>
      response.json(
        await service.adminGet(getAuth(request).userId, String(request.params.placementId)),
      ),
    ),
  );
  router.patch(
    "/banners/:placementId",
    asyncHandler(async (request, response) =>
      response.json(
        await service.setEnabled(
          getAuth(request).userId,
          String(request.params.placementId),
          pageBannerPlacementToggleSchema.parse(request.body).enabled,
        ),
      ),
    ),
  );
  router.post(
    "/banners/:placementId/slides/upload",
    raw({ type: "*/*", limit: "5mb" }),
    asyncHandler(async (request, response) => {
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      const query = request.query;
      const metadata = parsePageBannerMetadata({
        enabled: query.enabled === undefined ? undefined : String(query.enabled) === "true",
        isDecorative: query.isDecorative === "true",
        altText: query.altText === undefined ? null : String(query.altText),
        destination: query.destinationUrl
          ? {
              kind: query.destinationKind === "INTERNAL" ? "INTERNAL" : "EXTERNAL",
              url: String(query.destinationUrl),
            }
          : null,
      });
      response.status(201).json(
        await service.upload(getAuth(request).userId, String(request.params.placementId), {
          contentType: request.get("content-type") ?? "",
          body,
          metadata,
        }),
      );
    }),
  );
  router.post(
    "/banners/:placementId/slides/:slideId/upload",
    raw({ type: "*/*", limit: "5mb" }),
    asyncHandler(async (request, response) => {
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      const query = request.query;
      const metadata = parsePageBannerMetadata({
        enabled: query.enabled === undefined ? undefined : String(query.enabled) === "true",
        isDecorative: query.isDecorative === "true",
        altText: query.altText === undefined ? null : String(query.altText),
        destination: query.destinationUrl
          ? {
              kind: query.destinationKind === "INTERNAL" ? "INTERNAL" : "EXTERNAL",
              url: String(query.destinationUrl),
            }
          : null,
      });
      response.json(
        await service.upload(
          getAuth(request).userId,
          String(request.params.placementId),
          { contentType: request.get("content-type") ?? "", body, metadata },
          String(request.params.slideId),
        ),
      );
    }),
  );
  router.patch(
    "/banners/:placementId/slides/:slideId",
    asyncHandler(async (request, response) =>
      response.json(
        await service.updateSlide(
          getAuth(request).userId,
          String(request.params.placementId),
          String(request.params.slideId),
          request.body,
        ),
      ),
    ),
  );
  router.post(
    "/banners/:placementId/slides/reorder",
    asyncHandler(async (request, response) =>
      response.json(
        await service.reorder(
          getAuth(request).userId,
          String(request.params.placementId),
          pageBannerReorderSchema.parse(request.body).slideIds,
        ),
      ),
    ),
  );
  router.delete(
    "/banners/:placementId/slides/:slideId",
    asyncHandler(async (request, response) =>
      response.json(
        await service.deleteSlide(
          getAuth(request).userId,
          String(request.params.placementId),
          String(request.params.slideId),
        ),
      ),
    ),
  );
  return router;
}

export function createPageBannerPublicRouter(service: PageBannerService): Router {
  const router = Router();
  router.get(
    "/banners/:placementId",
    asyncHandler(async (request, response) =>
      response.json(await service.publicRead(String(request.params.placementId))),
    ),
  );
  return router;
}
