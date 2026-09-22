import { Router, raw } from "express";
import {
  helpRequestCreateSchema,
  helpRequestListQuerySchema,
  helpRequestRespondSchema,
  requestImageUploadSchema,
} from "@hooma/contracts/requests";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { RequestService } from "../application/request.service.js";

export function createRequestPublicRouter(service: RequestService): Router {
  const router = Router();

  router.get(
    "/",
    asyncHandler(async (request, response) => {
      response.json(await service.listPublic(helpRequestListQuerySchema.parse(request.query)));
    }),
  );

  router.get(
    "/:requestId/image",
    asyncHandler(async (request, response) => {
      const image = await service.getPublicImage(String(request.params.requestId));
      response
        .type(image.contentType)
        .set("content-length", String(image.sizeBytes))
        .send(Buffer.from(image.body));
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

export function createRequestMemberRouter(service: RequestService): Router {
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

  router.put(
    "/:requestId/image",
    raw({ type: "*/*", limit: "5mb" }),
    asyncHandler(async (request, response) => {
      const body = Buffer.isBuffer(request.body) ? new Uint8Array(request.body) : new Uint8Array();
      response.json(
        await service.replaceImage(
          getAuth(request).userId,
          String(request.params.requestId),
          requestImageUploadSchema.parse({
            contentType: request.header("content-type") ?? "application/octet-stream",
            body,
          }),
        ),
      );
    }),
  );

  router.delete(
    "/:requestId/image",
    asyncHandler(async (request, response) => {
      await service.deleteImage(getAuth(request).userId, String(request.params.requestId));
      response.status(204).end();
    }),
  );

  router.get(
    "/:requestId/image",
    asyncHandler(async (request, response) => {
      const image = await service.getMemberImage(
        getAuth(request).userId,
        String(request.params.requestId),
      );
      response
        .type(image.contentType)
        .set("content-length", String(image.sizeBytes))
        .send(Buffer.from(image.body));
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
    "/:requestId",
    asyncHandler(async (request, response) => {
      response.json(
        await service.getForMember(getAuth(request).userId, String(request.params.requestId)),
      );
    }),
  );

  return router;
}
