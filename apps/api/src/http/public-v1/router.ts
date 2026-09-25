import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "../../bootstrap/container.js";
import { createApiRateLimitMiddleware } from "../rate-limit/api-rate-limit.middleware.js";
import { createCommunityPublicRouter } from "../../modules/communities/http/community.routes.js";
import { createAthletesPublicRouter } from "../../modules/athletes/http/athletes.routes.js";
import { createDiscoveryPublicRouter } from "../../modules/discovery/http/discovery.routes.js";
import { createEventPublicRouter } from "../../modules/events/http/event.routes.js";
import { createGamerPublicRouter } from "../../modules/gamers/http/gamer.routes.js";
import {
  createIdentityProfilePublicRouter,
  createIdentityPublicRouter,
} from "../../modules/identity/http/identity.public.routes.js";
import { createPasswordRecoveryPublicRouter } from "../../modules/identity/http/password-recovery.public.routes.js";
import { createPlacesPublicRouter } from "../../modules/places/http/place.routes.js";
import { createPitchPublicRouter } from "../../modules/pitch/http/pitch.routes.js";
import { createPlayPublicRouter } from "../../modules/play/http/play.routes.js";
import { createRequestPublicRouter } from "../../modules/requests/http/request.routes.js";
import { createHelpTaxonomyPublicRouter } from "../../modules/help-taxonomy/http/help-taxonomy.routes.js";
import { createRidePublicRouter } from "../../modules/rides/http/ride.routes.js";
import { createTeamPublicRouter } from "../../modules/teams/http/team.routes.js";
import { createGearUpPublicRouter } from "../../modules/gear-up/http/gear-up.routes.js";

export function createPublicV1Router(container: AppContainer, config: ApiConfig): Router {
  const router = Router();
  router.use(
    "/auth/password-recovery",
    createApiRateLimitMiddleware(container.apiRateLimiter, {
      bucket: "password-recovery",
      methods: ["POST"],
      limit: config.API_RATE_LIMIT_PASSWORD_RECOVERY_MAX_REQUESTS,
    }),
  );
  router.use(
    "/auth/password-recovery",
    createPasswordRecoveryPublicRouter(container.passwordRecoveryService),
  );
  router.use(
    "/auth",
    createApiRateLimitMiddleware(container.apiRateLimiter, {
      bucket: "auth-write",
      methods: ["POST"],
      limit: config.API_RATE_LIMIT_AUTH_MAX_REQUESTS,
    }),
  );
  router.use("/auth", createIdentityPublicRouter(container.identityService, config));
  router.use("/profiles", createIdentityProfilePublicRouter(container.identityService));
  router.use("/places", createPlacesPublicRouter(container.placeService));
  router.use("/pitch", createPitchPublicRouter(container.approvedPitchReader));
  router.use(
    "/gear-up",
    createGearUpPublicRouter(
      container.gearUpService,
      container.gearUpProductService,
      container.gearUpProductMediaService,
    ),
  );
  router.use("/communities", createCommunityPublicRouter(container.communityService));
  router.use("/athletes", createAthletesPublicRouter(container.athletesService));
  router.use("/teams", createTeamPublicRouter(container.teamService));
  router.use(
    "/events",
    createEventPublicRouter(container.eventService, container.identityService, config),
  );
  router.use("/gamers", createGamerPublicRouter(container.gamerService));
  router.use("/play", createPlayPublicRouter(container.playService));
  router.use(
    "/requests",
    createRequestPublicRouter(container.requestService, container.requestMediaService),
  );
  router.use("/help/taxonomy", createHelpTaxonomyPublicRouter(container.helpTaxonomyService));
  router.use("/rides", createRidePublicRouter(container.rideService));
  router.use(
    "/discovery",
    createApiRateLimitMiddleware(container.apiRateLimiter, {
      bucket: "public-discovery",
      methods: ["GET"],
      limit: config.API_RATE_LIMIT_DISCOVERY_MAX_REQUESTS,
    }),
  );
  router.use("/discovery", createDiscoveryPublicRouter(container.discoveryService));
  return router;
}
