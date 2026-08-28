import { Router } from "express";
import { pitchApplicationSchema } from "@hooma/contracts/pitch";
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

export function createPitchMemberRouter(owner: PitchOwnerService): Router {
  const router = Router();
  router.get(
    "/:placeId/manage",
    asyncHandler(async (request, response) => {
      response.json(
        await owner.getManagementState(getAuth(request).userId, String(request.params.placeId)),
      );
    }),
  );
  router.post(
    "/:placeId/applications",
    asyncHandler(async (request, response) => {
      response
        .status(201)
        .json(
          await owner.submitRevision(
            getAuth(request).userId,
            String(request.params.placeId),
            pitchApplicationSchema.parse(request.body),
          ),
        );
    }),
  );
  return router;
}
