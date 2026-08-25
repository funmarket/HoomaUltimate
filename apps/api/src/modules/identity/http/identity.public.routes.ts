import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import { loginSchema, registerSchema } from "@hooma/contracts";
import { telegramOidcStartSchema } from "@hooma/contracts/auth-linking";
import { AppError } from "../../../http/errors/app-error.js";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { IdentityService } from "../application/identity.service.js";
import { resolveAuthentication } from "./auth.middleware.js";
import { readCookie, setSessionCookie } from "./cookies.js";
import {
  beginTelegramWebFlow,
  clearTelegramWebFlow,
  completeTelegramWebFlow,
  readTelegramWebFlow,
  telegramWebLoginConfigured,
  webRedirect,
} from "./telegram-web-auth.js";

export function createIdentityPublicRouter(service: IdentityService, config: ApiConfig): Router {
  const router = Router();

  router.get(
    "/session",
    asyncHandler(async (request, response) => {
      const auth = await resolveAuthentication(request, service, config);
      response.json(auth ? await service.me(auth.userId, auth.transports) : null);
    }),
  );

  router.post(
    "/register",
    asyncHandler(async (request, response) => {
      const { sessionToken } = await service.register(registerSchema.parse(request.body));
      setSessionCookie(response, config, sessionToken);
      response.status(201).json({ ok: true });
    }),
  );

  router.post(
    "/login",
    asyncHandler(async (request, response) => {
      const { sessionToken } = await service.login(loginSchema.parse(request.body));
      setSessionCookie(response, config, sessionToken);
      response.json({ ok: true });
    }),
  );

  router.post(
    "/telegram/account",
    asyncHandler(async (request, response) => {
      const authorization = request.header("authorization") ?? "";
      const [scheme, rawInitData] = authorization.split(" ", 2);
      const webUserId = await service.resolveWebSession(
        readCookie(request, config.SESSION_COOKIE_NAME),
      );
      await service.provisionTelegramAccount(
        scheme?.toLowerCase() === "tma" ? rawInitData : undefined,
        webUserId,
      );
      response.status(201).json({ ok: true });
    }),
  );

  router.post("/telegram/web/start", (request, response) => {
    const input = telegramOidcStartSchema.parse(request.body);
    const authorizationUrl = beginTelegramWebFlow(response, config, {
      mode: "login",
      returnTo: input.returnTo,
    });
    response.json({
      enabled: telegramWebLoginConfigured(config),
      authorizationUrl,
    });
  });

  router.get(
    "/telegram/web/callback",
    asyncHandler(async (request, response) => {
      let returnTo = "/login";
      try {
        const flow = readTelegramWebFlow(request, config);
        returnTo = flow.returnTo;
        clearTelegramWebFlow(response, config);
        const identity = await completeTelegramWebFlow(request, config, flow);
        if (flow.mode === "login") {
          const { sessionToken } = await service.loginWithTelegramIdentity(identity);
          setSessionCookie(response, config, sessionToken);
          response.redirect(webRedirect(config, returnTo, { telegramLogin: "success" }));
          return;
        }

        const webUserId = await service.resolveWebSession(
          readCookie(request, config.SESSION_COOKIE_NAME),
        );
        if (!flow.userId || !webUserId || webUserId !== flow.userId) {
          throw new AppError(
            401,
            "ACCOUNT_LINK_AUTH_REQUIRED",
            "The Web account session used to start linking is no longer valid",
          );
        }
        await service.linkTelegramIdentity(flow.userId, identity);
        response.redirect(webRedirect(config, returnTo, { telegramLinked: "success" }));
      } catch (error) {
        clearTelegramWebFlow(response, config);
        const code = error instanceof AppError ? error.code : "TELEGRAM_WEB_LOGIN_FAILED";
        response.redirect(webRedirect(config, returnTo, { telegramError: code }));
      }
    }),
  );

  return router;
}

export function createIdentityProfilePublicRouter(service: IdentityService): Router {
  const router = Router();
  router.get(
    "/:username",
    asyncHandler(async (request, response) => {
      response.json(await service.publicProfile(String(request.params.username)));
    }),
  );
  return router;
}
