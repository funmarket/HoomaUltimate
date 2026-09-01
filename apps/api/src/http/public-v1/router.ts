import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "../../bootstrap/container.js";
import { createCommunityPublicRouter } from "../../modules/communities/http/community.routes.js";
import { createAthletesPublicRouter } from "../../modules/athletes/http/athletes.routes.js";
import { createDiscoveryPublicRouter } from "../../modules/discovery/http/discovery.routes.js";
import { createEventPublicRouter } from "../../modules/events/http/event.routes.js";
import { createGamerPublicRouter } from "../../modules/gamers/http/gamer.routes.js";
import {
  createIdentityProfilePublicRouter,
  createIdentityPublicRouter,
} from "../../modules/identity/http/identity.public.routes.js";
import { createPlacesPublicRouter } from "../../modules/places/http/place.routes.js";
import { createPitchPublicRouter } from "../../modules/pitch/http/pitch.routes.js";
import { createPlayPublicRouter } from "../../modules/play/http/play.routes.js";
import { createRidePublicRouter } from "../../modules/rides/http/ride.routes.js";
import { createTeamPublicRouter } from "../../modules/teams/http/team.routes.js";

export function createPublicV1Router(container: AppContainer, config: ApiConfig): Router {
  const router = Router();
  router.use("/auth", createIdentityPublicRouter(container.identityService, config));
  router.use("/profiles", createIdentityProfilePublicRouter(container.identityService));
  router.use("/places", createPlacesPublicRouter(container.placeService));
  router.use("/pitch", createPitchPublicRouter(container.approvedPitchReader));
  router.use("/communities", createCommunityPublicRouter(container.communityService));
  router.use("/athletes", createAthletesPublicRouter(container.athletesService));
  router.use("/teams", createTeamPublicRouter(container.teamService));
  router.use(
    "/events",
    createEventPublicRouter(container.eventService, container.identityService, config),
  );
  router.use("/gamers", createGamerPublicRouter(container.gamerService));
  router.use("/play", createPlayPublicRouter(container.playService));
  router.use("/rides", createRidePublicRouter(container.rideService));
  router.use("/discovery", createDiscoveryPublicRouter(container.discoveryService));
  return router;
}
