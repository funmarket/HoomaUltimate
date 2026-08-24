import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "../../bootstrap/container.js";
import {
  createIdentityProfilePublicRouter,
  createIdentityPublicRouter,
} from "../../modules/identity/http/identity.public.routes.js";
import { createCommunityPublicRouter } from "../../modules/communities/http/community.routes.js";
import { createTeamPublicRouter } from "../../modules/teams/http/team.routes.js";
import { createEventPublicRouter } from "../../modules/events/http/event.routes.js";
import { createGamerPublicRouter } from "../../modules/gamers/http/gamer.routes.js";
import { createPlayPublicRouter } from "../../modules/play/http/play.routes.js";

export function createPublicV1Router(container: AppContainer, config: ApiConfig): Router {
  const router = Router();
  router.use("/auth", createIdentityPublicRouter(container.identityService, config));
  router.use("/profiles", createIdentityProfilePublicRouter(container.identityService));
  router.use("/communities", createCommunityPublicRouter(container.communityService));
  router.use("/teams", createTeamPublicRouter(container.teamService));
  router.use("/events", createEventPublicRouter(container.eventService));
  router.use("/gamers", createGamerPublicRouter(container.gamerService));
  router.use("/play", createPlayPublicRouter(container.playService));
  return router;
}
