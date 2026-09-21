import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import { profilePresentationUpdateSchema } from "@hooma/contracts";
import { webCredentialAttachSchema } from "@hooma/contracts/auth-linking";
import { profileUpdateSchema } from "@hooma/contracts/profile";
import { AppError } from "../../../http/errors/app-error.js";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { PasswordRecoveryService } from "../application/password-recovery.service.js";
import type { IdentityService } from "../application/identity.service.js";
import { getAuth } from "./auth-request.js";
import { clearSessionCookie, readCookie } from "./cookies.js";

export function createIdentityMemberRouter(
  service: IdentityService,
  config: ApiConfig,
  passwordRecoveryService: PasswordRecoveryService,
): Router {
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

  router.post(
    "/auth/password-recovery/notifications/:notificationId/code",
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      if (!auth.transports.includes("telegram")) {
        throw new AppError(
          403,
          "PASSWORD_RECOVERY_TELEGRAM_REQUIRED",
          "Open this recovery notification inside Telegram",
        );
      }
      response.json(
        await passwordRecoveryService.issueCodeFromNotification(
          auth.userId,
          String(request.params.notificationId),
        ),
      );
    }),
  );

  router.post(
    "/auth/telegram-link/code",
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      response.json(await service.createTelegramLinkCode(auth.userId, auth.transports));
    }),
  );

  router.get(
    "/me/profile",
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      response.json(await service.profile(auth.userId));
    }),
  );

  router.post(
    "/me/profile/identities/gamer",
    asyncHandler(async (request, response) => {
      const auth = getAuth(request);
      response.json(await service.enableProfileIdentity(auth.userId, "GAMER"));
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
