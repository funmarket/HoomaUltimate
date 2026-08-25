import { Router } from "express";
import { profilePresentationUpdateSchema } from "@hooma/contracts";
import { telegramOidcStartSchema, webCredentialAttachSchema } from "@hooma/contracts/auth-linking";
import { profileUpdateSchema } from "@hooma/contracts/profile";
import type { ApiConfig } from "@hooma/config";
import { AppError } from "../../../http/errors/app-error.js";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { IdentityService } from "../application/identity.service.js";
import { getAuth } from "./auth-request.js";
import { clearSessionCookie, readCookie } from "./cookies.js";
import { beginTelegramWebFlow, telegramWebLoginConfigured } from "./telegram-web-auth.js";

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
    "/me/login-methods",
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      response.json(await service.loginMethods(auth.userId));
    }),
  );

  router.post(
    "/auth/web-credential",
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      response
        .status(201)
        .json(
          await service.addWebCredential(
            auth.userId,
            webCredentialAttachSchema.parse(request.body),
          ),
        );
    }),
  );

  router.post("/auth/telegram/link/start", (request, response) => {
    const auth = getAuth(request);
    if (!auth.transports.includes("web")) {
      throw new AppError(
        401,
        "WEB_AUTH_REQUIRED",
        "A current Web session is required to link a Telegram account",
      );
    }
    const input = telegramOidcStartSchema.parse(request.body);
    const authorizationUrl = beginTelegramWebFlow(response, config, {
      mode: "link",
      returnTo: input.returnTo,
      userId: auth.userId,
    });
    response.json({
      enabled: telegramWebLoginConfigured(config),
      authorizationUrl,
    });
  });

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
      response.json(
        await service.updateProfile(auth.userId, profileUpdateSchema.parse(request.body)),
      );
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
