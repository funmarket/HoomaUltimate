import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "../../bootstrap/container.js";
import { createIdentityPublicRouter } from "../../modules/identity/http/identity.public.routes.js";
import { createCommunityPublicRouter } from "../../modules/communities/http/community.routes.js";
import { createTeamPublicRouter } from "../../modules/teams/http/team.routes.js";
import { createEventPublicRouter } from "../../modules/events/http/event.routes.js";

export function createPublicV1Router(container: AppContainer, config: ApiConfig): Router {
  const router = Router();
  router.use("/auth", createIdentityPublicRouter(container.identityService, config));
  router.use("/communities", createCommunityPublicRouter(container.communityService));
  router.use("/teams", createTeamPublicRouter(container.teamService));
  router.use("/events", createEventPublicRouter(container.eventService));
  return router;
}
