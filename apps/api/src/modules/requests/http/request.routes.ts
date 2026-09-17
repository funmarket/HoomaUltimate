import { Router } from "express";
import {
  helpRequestCreateSchema,
  helpRequestListQuerySchema,
  helpRequestRespondSchema,
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
