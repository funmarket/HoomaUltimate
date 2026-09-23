import { Buffer } from "node:buffer";
import { Router, raw } from "express";
import {
  helpRequestCreateSchema,
  helpRequestExternalImageInputSchema,
  helpRequestListQuerySchema,
  helpRequestRespondSchema,
} from "@hooma/contracts/requests";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { RequestMediaService } from "../application/request-media.service.js";
import type { RequestService } from "../application/request.service.js";

export function createRequestPublicRouter(
  service: RequestService,
  media: RequestMediaService,
): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (request, response) => {
      response.json(await service.listPublic(helpRequestListQuerySchema.parse(request.query)));
    }),
  );

  router.get(
    "/:requestId/image/delivery",
    asyncHandler(async (request, response) => {
      response.setHeader("cache-control", "private, no-store");
      response.json(await media.deliveryPublic(String(request.params.requestId)));
    }),
  );

  router.get(
    "/:requestId",
    asyncHandler(async (request, response) => {
      response.json(await service.getPublic(String(request.params.requestId)));
    }),
  );

  return router;
}

export function createRequestMemberRouter(
  service: RequestService,
  media: RequestMediaService,
): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (request, response) => {
      response.json(
        await service.listForMember(
          getAuth(request).userId,
          helpRequestListQuerySchema.parse(request.query),
        ),
      );
    }),
  );

  router.post(
    "/",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.create(
            getAuth(request).userId,
            helpRequestCreateSchema.parse(request.body),
          ),
        );
    }),
  );

  router.post(
    "/:requestId/responses",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await service.respond(
            getAuth(request).userId,
            String(request.params.requestId),
            helpRequestRespondSchema.parse(request.body),
          ),
        );
    }),
  );

  router.get(
    "/:requestId/responses",
    asyncHandler(async (request, response) => {
      response.json(
        await service.listResponses(getAuth(request).userId, String(request.params.requestId)),
      );
    }),
  );

  router.post(
    "/:requestId/responses/:responseId/accept",
    asyncHandler(async (request, response) => {
      response.json(
        await service.acceptResponse(
          getAuth(request).userId,
          String(request.params.requestId),
          String(request.params.responseId),
        ),
      );
    }),
  );

  router.post(
    "/:requestId/responses/:responseId/decline",
    asyncHandler(async (request, response) => {
      response.json(
        await service.declineResponse(
          getAuth(request).userId,
          String(request.params.requestId),
          String(request.params.responseId),
        ),
      );
    }),
  );

  router.post(
    "/:requestId/responses/:responseId/withdraw",
    asyncHandler(async (request, response) => {
      response.json(
        await service.withdrawResponse(
          getAuth(request).userId,
          String(request.params.requestId),
          String(request.params.responseId),
        ),
      );
    }),
  );

  router.post(
    "/:requestId/fulfill",
    asyncHandler(async (request, response) => {
      response.json(
        await service.fulfill(getAuth(request).userId, String(request.params.requestId)),
      );
    }),
  );

  router.post(
    "/:requestId/cancel",
    asyncHandler(async (request, response) => {
      response.json(
        await service.cancel(getAuth(request).userId, String(request.params.requestId)),
      );
    }),
  );

  router.get(
    "/:requestId/image/delivery",
    asyncHandler(async (request, response) => {
      response.setHeader("cache-control", "private, no-store");
      response.json(
        await media.deliveryForMember(
          getAuth(request).userId,
          String(request.params.requestId),
        ),
      );
    }),
  );

  router.put(
    "/:requestId/image",
    raw({ type: "*/*", limit: "5mb" }),
    asyncHandler(async (request, response) => {
      const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
      response.json(
        await media.replaceUpload(getAuth(request).userId, String(request.params.requestId), {
          contentType: request.get("content-type") ?? "",
          body,
        }),
      );
    }),
  );

  router.put(
    "/:requestId/image/external",
    asyncHandler(async (request, response) => {
      response.json(
        await media.replaceExternalUrl(
          getAuth(request).userId,
          String(request.params.requestId),
          helpRequestExternalImageInputSchema.parse(request.body),
        ),
      );
    }),
  );

  router.delete(
    "/:requestId/image",
    asyncHandler(async (request, response) => {
      await media.delete(getAuth(request).userId, String(request.params.requestId));
      response.json({ ok: true });
    }),
  );

  router.get(
    "/:requestId",
    asyncHandler(async (request, response) => {
      response.json(
        await service.getForMember(getAuth(request).userId, String(request.params.requestId)),
      );
    }),
  );

  return router;
}
