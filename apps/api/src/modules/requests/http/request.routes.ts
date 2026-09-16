import { Router } from "express";
import {
  helpRequestCreateSchema,
  helpRequestListQuerySchema,
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
          await service.create(getAuth(request).userId, helpRequestCreateSchema.parse(request.body)),
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
