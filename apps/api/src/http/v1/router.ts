import { Router } from "express";
import type { ApiConfig } from "@hooma/config";
import type { AppContainer } from "../../bootstrap/container.js";
import { requireAuthentication } from "../../modules/identity/http/auth.middleware.js";
import { createIdentityMemberRouter } from "../../modules/identity/http/identity.member.routes.js";
import { createPlatformAdminRouter } from "../../modules/platform-admin/http/platform-admin.routes.js";
import { createPlacesMemberRouter } from "../../modules/places/http/place.routes.js";
import { createPitchMemberRouter } from "../../modules/pitch/http/pitch.routes.js";
import { createCommunityMemberRouter } from "../../modules/communities/http/community.routes.js";
import { createAthletesMemberRouter } from "../../modules/athletes/http/athletes.routes.js";
import { createTeamMemberRouter } from "../../modules/teams/http/team.routes.js";
import { createEventMemberRouter } from "../../modules/events/http/event.routes.js";
import { createGamerMemberRouter } from "../../modules/gamers/http/gamer.routes.js";
import { createPlayMemberRouter } from "../../modules/play/http/play.routes.js";
import { createRideCommunityInteractionRouter } from "../../modules/rides/http/ride-community-interaction.routes.js";
import { createRideMemberRouter } from "../../modules/rides/http/ride.routes.js";
import { createWhistleRouter } from "../../modules/whistle/http/whistle.routes.js";
import { createUserNotificationRouter } from "../../modules/notifications/http/user-notification.routes.js";

export function createMemberV1Router(container: AppContainer, config: ApiConfig): Router {
  const router = Router();
  router.use(requireAuthentication(container.identityService, config));
  router.use(createIdentityMemberRouter(container.identityService, config));
  router.use(
    "/admin",
    createPlatformAdminRouter(
      container.platformAdminService,
      container.placeService,
      container.pitchModerationService,
      container.gamerMatchService,
    ),
  );
  router.use("/places", createPlacesMemberRouter(container.placeService));
  router.use(
    "/pitch",
    createPitchMemberRouter(container.pitchSuggestionService, container.pitchOwnerService),
  );
  router.use("/communities", createCommunityMemberRouter(container.communityService));
  router.use(
    "/athletes",
    createAthletesMemberRouter(container.athletesService, container.athletesPhotoService),
  );
  router.use("/teams", createTeamMemberRouter(container.teamService));
  router.use("/events", createEventMemberRouter(container.eventService));
  router.use(
    "/gamers",
    createGamerMemberRouter(container.gamerService, container.gamerMatchService),
  );
  router.use("/play", createPlayMemberRouter(container.playService));
  router.use("/rides", createRideMemberRouter(container.rideService));
  router.use(
    "/rides",
    createRideCommunityInteractionRouter(container.rideCommunityInteractionService),
  );
  router.use("/notifications", createUserNotificationRouter(container.userNotificationService));
  router.use("/whistles", createWhistleRouter(container.whistleService));
  return router;
}
