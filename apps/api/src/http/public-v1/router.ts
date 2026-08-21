import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "../../bootstrap/container.js";
import { createIdentityPublicRouter } from "../../modules/identity/http/identity.public.routes.js";

export function createPublicV1Router(container: AppContainer, config: ApiConfig): Router {
  const router = Router();
  router.use("/auth", createIdentityPublicRouter(container.identityService, config));
  return router;
}
