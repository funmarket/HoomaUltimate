import { Router } from "express";
import { placeCapabilityApplicationSchema } from "@hooma/contracts/pitch";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { ApprovedPitchReader } from "../application/approved-pitch.reader.js";
import type { PitchOwnerService } from "../application/pitch-owner.service.js";

export function createPitchPublicRouter(reader: ApprovedPitchReader): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (_request, response) => response.json(await reader.listApproved())),
  );
  router.get(
    "/:placeId",
    asyncHandler(async (request, response) => {
      response.json(await reader.getApproved(String(request.params.placeId)));
    }),
  );
  return router;
}

export function createPitchMemberRouter(service: PitchOwnerService): Router {
  const router = Router();
  router.get(
    "/:placeId/manage",
    asyncHandler(async (request, response) => {
      response.json(
        await service.getManagementState(getAuth(request).userId, String(request.params.placeId)),
      );
    }),
  );
  router.post(
    "/applications",
    asyncHandler(async (request, response) => {
      const placeId = String((request.body as { placeId?: unknown }).placeId ?? "");
      response
        .status(201)
        .json(
          await service.submit(
            getAuth(request).userId,
            placeId,
            placeCapabilityApplicationSchema.parse(request.body),
          ),
        );
    }),
  );
  return router;
}
