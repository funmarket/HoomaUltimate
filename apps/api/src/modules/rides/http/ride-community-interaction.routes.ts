import { Router } from "express";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { RideCommunityInteractionService } from "../application/ride-community-interaction.service.js";

export function createRideCommunityInteractionRouter(
  service: RideCommunityInteractionService,
): Router {
  const router = Router();

  router.get(
    "/communities/:communityId/requests/:requestId/interaction",
    asyncHandler(async (request, response) => {
      response.json(
        await service.getRequestInteraction(
          getAuth(request).userId,
          String(request.params.communityId),
          String(request.params.requestId),
        ),
      );
    }),
  );

  return router;
}
