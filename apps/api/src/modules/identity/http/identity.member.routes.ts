import { Router } from "express";
import { profilePresentationUpdateSchema } from "@hooma/contracts";
import { profileUpdateSchema } from "@hooma/contracts/profile";
import type { ApiConfig } from "@hooma/config";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { IdentityService } from "../application/identity.service.js";
import { getAuth } from "./auth-request.js";
import { clearSessionCookie, readCookie } from "./cookies.js";

export function createIdentityMemberRouter(service: IdentityService, config: ApiConfig): Router {
  const router = Router();

  router.get(
    "/me",
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      response.json(await service.me(auth.userId, auth.transports));
    }),
  );

  router.get(
    "/me/profile",
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      response.json(await service.profile(auth.userId));
    }),
  );

  router.patch(
    "/me/profile",
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      response.json(await service.updateProfile(auth.userId, profileUpdateSchema.parse(request.body)));
    }),
  );

  router.patch(
    "/me/presentation",
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      response.json(
        await service.updatePresentation(
          auth.userId,
          auth.transports,
          profilePresentationUpdateSchema.parse(request.body),
        ),
      );
    }),
  );

  router.post(
    "/auth/logout",
    asyncHandler(async (request, response) => {
      await service.logout(readCookie(request, config.SESSION_COOKIE_NAME));
      clearSessionCookie(response, config);
      response.json({ ok: true });
    }),
  );

  return router;
}
