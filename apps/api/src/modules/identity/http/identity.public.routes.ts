import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import { loginSchema, registerSchema } from "@hooma/contracts";
import { asyncHandler } from "../../../http/middleware/async-handler.js";
import type { IdentityService } from "../application/identity.service.js";
import { setSessionCookie } from "./cookies.js";

export function createIdentityPublicRouter(service: IdentityService, config: ApiConfig): Router {
  const router = Router();

  router.post(
    "/register",
    asyncHandler(async (request, response) => {
      const { sessionToken } = await service.register(registerSchema.parse(request.body));
      setSessionCookie(response, config, sessionToken);
      response.status(201).json({ ok: true });
    })
  );

  router.post(
    "/login",
    asyncHandler(async (request, response) => {
      const { sessionToken } = await service.login(loginSchema.parse(request.body));
      setSessionCookie(response, config, sessionToken);
      response.json({ ok: true });
    })
  );

  return router;
}
