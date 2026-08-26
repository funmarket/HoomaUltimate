import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "../../bootstrap/container.js";
import { requireAuthentication } from "../../modules/identity/http/auth.middleware.js";
import { createIdentityMemberRouter } from "../../modules/identity/http/identity.member.routes.js";
import { createPlatformAdminRouter } from "../../modules/platform-admin/http/platform-admin.routes.js";
import {
  createPlaceCapabilityMemberRouter,
  createPlacesMemberRouter,
} from "../../modules/places/http/place.routes.js";
import { createCommunityMemberRouter } from "../../modules/communities/http/community.routes.js";
import { createTeamMemberRouter } from "../../modules/teams/http/team.routes.js";
import { createEventMemberRouter } from "../../modules/events/http/event.routes.js";
import { createGamerMemberRouter } from "../../modules/gamers/http/gamer.routes.js";
import { createPlayMemberRouter } from "../../modules/play/http/play.routes.js";
import { createWhistleRouter } from "../../modules/whistle/http/whistle.routes.js";

export function createMemberV1Router(container: AppContainer, config: ApiConfig): Router {
  const router = Router();
  router.use(requireAuthentication(container.identityService, config));
  router.use(createIdentityMemberRouter(container.identityService, config));
  router.use(
    "/admin",
    createPlatformAdminRouter(
      container.platformAdminService,
      container.placeService,
      container.pitchService,
    ),
  );
  router.use("/places", createPlacesMemberRouter(container.placeService));
  router.use("/pitch", createPlaceCapabilityMemberRouter(container.pitchService));
  router.use("/communities", createCommunityMemberRouter(container.communityService));
  router.use("/teams", createTeamMemberRouter(container.teamService));
  router.use("/events", createEventMemberRouter(container.eventService));
  router.use("/gamers", createGamerMemberRouter(container.gamerService));
  router.use("/play", createPlayMemberRouter(container.playService));
  router.use("/whistles", createWhistleRouter(container.whistleService));
  return router;
}
