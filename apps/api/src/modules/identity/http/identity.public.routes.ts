import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import { loginSchema, registerSchema } from "@hooma/contracts";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { IdentityService } from "../application/identity.service.js";
import { resolveAuthentication } from "./auth.middleware.js";
import { readCookie, setSessionCookie } from "./cookies.js";

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
