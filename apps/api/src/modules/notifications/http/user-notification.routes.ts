import { Router } from "express";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import { getAuth } from "../../identity/http/auth-request.js";
import type { UserNotificationService } from "../application/user-notification.service.js";

export function createUserNotificationRouter(service: UserNotificationService): Router {
  const router = Router();
  router.get(
    "/",
    asyncHandler(async (request, response) => {
      response.json(await service.listForRecipient(getAuth(request).userId));
    }),
  );
  return router;
}
