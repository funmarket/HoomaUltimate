import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "../../bootstrap/container.js";
import { requireAuthentication } from "../../modules/identity/http/auth.middleware.js";
import { createIdentityMemberRouter } from "../../modules/identity/http/identity.member.routes.js";

export function createMemberV1Router(container: AppContainer, config: ApiConfig): Router {
  const router = Router();
  router.use(requireAuthentication(container.identityService, config));
  router.use(createIdentityMemberRouter(container.identityService, config));
  return router;
}
