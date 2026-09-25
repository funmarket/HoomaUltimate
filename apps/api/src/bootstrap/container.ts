import { SharpAthletesPhotoOptimizer } from "../modules/athletes/infrastructure/sharp-athletes-photo-optimizer.js";
import { SharpAthletesPhotoValidator } from "../modules/athletes/infrastructure/sharp-athletes-photo-validator.js";
import type { ApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import {
  S3ObjectStorage,
  type ObjectStorage,
  type ObjectStorageReadinessProbe,
} from "@hooma/storage";
import { RedisClient } from "../infrastructure/redis/redis-client.js";
import { RedisApiRateLimiter } from "../http/rate-limit/redis-api-rate-limiter.js";
import { IdentityAdminService } from "../modules/identity/application/identity-admin.service.js";
import { IdentityService } from "../modules/identity/application/identity.service.js";
import { PasswordRecoveryService } from "../modules/identity/application/password-recovery.service.js";
import { PrismaIdentityAdminRepository } from "../modules/identity/infrastructure/prisma-identity-admin.repository.js";
import { PrismaIdentityRepository } from "../modules/identity/infrastructure/prisma-identity.repository.js";
import { PrismaPasswordRecoveryRepository } from "../modules/identity/infrastructure/prisma-password-recovery.repository.js";
import { PrismaCanonicalUserReader } from "../modules/identity/infrastructure/prisma-canonical-user.reader.js";
import { PrismaUserPresentationReader } from "../modules/identity/infrastructure/prisma-user-presentation.reader.js";
import { PrismaUserLastSeenReader } from "../modules/identity/infrastructure/prisma-user-last-seen.reader.js";
import { PrismaWebSessionActivity } from "../modules/identity/infrastructure/prisma-web-session-activity.js";
import { PrismaPlatformAdminRepository } from "../modules/platform-admin/infrastructure/prisma-platform-admin.repository.js";
import { PlatformAdminService } from "../modules/platform-admin/application/platform-admin.service.js";
import { PlaceService } from "../modules/places/application/place.service.js";
import { HttpExternalPlaceImageResolver } from "../modules/places/infrastructure/http-external-place-image-resolver.js";
import { PrismaPlaceRepository } from "../modules/places/infrastructure/prisma-place.repository.js";
import { ApprovedPitchReader } from "../modules/pitch/application/approved-pitch.reader.js";
import { PitchOwnerService } from "../modules/pitch/application/pitch-owner.service.js";
import { PitchModerationService } from "../modules/pitch/application/pitch-moderation.service.js";
import { PitchSuggestionService } from "../modules/pitch/application/pitch-suggestion.service.js";
import { PrismaPitchRepository } from "../modules/pitch/infrastructure/prisma-pitch.repository.js";
import { CommunityService } from "../modules/communities/application/community.service.js";
import { PrismaCommunityRepository } from "../modules/communities/infrastructure/prisma-community.repository.js";
import { AthletesCalendarService } from "../modules/athletes/application/athletes-calendar.service.js";
import { AthletesPhotoService } from "../modules/athletes/application/athletes-photo.service.js";
import { AthletesService } from "../modules/athletes/application/athletes.service.js";
import { PrismaAthletesCalendarRepository } from "../modules/athletes/infrastructure/prisma-athletes-calendar.repository.js";
import { PrismaAthletesPhotoRepository } from "../modules/athletes/infrastructure/prisma-athletes-photo.repository.js";
import { PrismaAthletesRepository } from "../modules/athletes/infrastructure/prisma-athletes.repository.js";
import { TeamService } from "../modules/teams/application/team.service.js";
import { PrismaTeamLifecycleRepository } from "../modules/teams/infrastructure/prisma-team-lifecycle.repository.js";
import { PrismaTeamRepository } from "../modules/teams/infrastructure/prisma-team.repository.js";
import { EventService } from "../modules/events/application/event.service.js";
import { PrismaEventRepository } from "../modules/events/infrastructure/prisma-event.repository.js";
import { GamerMatchService } from "../modules/gamers/application/gamer-match.service.js";
import { GamerService } from "../modules/gamers/application/gamer.service.js";
import { PrismaGamerChallengeRepository } from "../modules/gamers/infrastructure/prisma-gamer-challenge.repository.js";
import { PrismaGamerEligibilityRepository } from "../modules/gamers/infrastructure/prisma-gamer-eligibility.repository.js";
import { PrismaGamerGameRepository } from "../modules/gamers/infrastructure/prisma-gamer-game.repository.js";
import { PrismaGamerMatchRepository } from "../modules/gamers/infrastructure/prisma-gamer-match.repository.js";
import { PrismaGamerProfileRepository } from "../modules/gamers/infrastructure/prisma-gamer-profile.repository.js";
import { PlayService } from "../modules/play/application/play.service.js";
import { PrismaPlayPlayerListingRepository } from "../modules/play/infrastructure/prisma-play.repository.js";
import { RequestMediaService } from "../modules/requests/application/request-media.service.js";
import { RequestService } from "../modules/requests/application/request.service.js";
import { PrismaRequestImageRepository } from "../modules/requests/infrastructure/prisma-request-image.repository.js";
import { PrismaRequestRepository } from "../modules/requests/infrastructure/prisma-request.repository.js";
import { SharpRequestImageProcessor } from "../modules/requests/infrastructure/sharp-request-image-processor.js";
import { HelpTaxonomyService } from "../modules/help-taxonomy/application/help-taxonomy.service.js";
import { PrismaHelpTaxonomyRepository } from "../modules/help-taxonomy/infrastructure/prisma-help-taxonomy.repository.js";
import { RideCommunityInteractionService } from "../modules/rides/application/ride-community-interaction.service.js";
import { RideService } from "../modules/rides/application/ride.service.js";
import { PrismaRideCommunityInteractionRepository } from "../modules/rides/infrastructure/prisma-ride-community-interaction.repository.js";
import {
  PrismaRideOfferRepository,
  PrismaRideRequestRepository,
} from "../modules/rides/infrastructure/prisma-ride.repository.js";
import { PrismaRideReferenceReader } from "../modules/rides/infrastructure/prisma-ride-reference.readers.js";
import { PrismaRideVehiclePhotoRepository } from "../modules/rides/infrastructure/prisma-ride-vehicle-photo.repository.js";
import { StadiaRideStaticMapProvider } from "../modules/rides/infrastructure/stadia-ride-static-map-provider.js";
import { WhistleService } from "../modules/whistle/application/whistle.service.js";
import { PrismaWhistleRepository } from "../modules/whistle/infrastructure/prisma-whistle.repository.js";
import { RedisWhistleStore } from "../modules/whistle/infrastructure/redis-whistle-store.js";
import { UserNotificationService } from "../modules/notifications/application/user-notification.service.js";
import { PrismaUserNotificationRepository } from "../modules/notifications/infrastructure/prisma-user-notification.repository.js";
import { DiscoveryService } from "../modules/discovery/application/discovery.service.js";
import { PrismaDiscoveryRepository } from "../modules/discovery/infrastructure/prisma-discovery.repository.js";
import { ReadinessService } from "../modules/system/application/readiness.service.js";
import { PrismaReadinessProbe } from "../modules/system/infrastructure/prisma-readiness.probe.js";
import { RedisReadinessProbe } from "../modules/system/infrastructure/redis-readiness.probe.js";
import { GearUpService } from "../modules/gear-up/application/gear-up.service.js";
import { GearUpProductService } from "../modules/gear-up/application/gear-up-product.service.js";
import { GearUpProductMediaService } from "../modules/gear-up/application/gear-up-product-media.service.js";
import { GearUpSettingsService } from "../modules/gear-up/application/gear-up-settings.service.js";
import { PrismaGearUpRepository } from "../modules/gear-up/infrastructure/prisma-gear-up.repository.js";
import { PrismaGearUpProductRepository } from "../modules/gear-up/infrastructure/prisma-gear-up-product.repository.js";
import { PrismaGearUpProductMediaRepository } from "../modules/gear-up/infrastructure/prisma-gear-up-product-media.repository.js";
import { SharpGearUpProductImageProcessor } from "../modules/gear-up/infrastructure/sharp-gear-up-product-image-processor.js";

interface ContainerOverrides {
  readonly objectStorage?: ObjectStorage | null;
}

function objectStorage(
  config: ApiConfig,
  overrides: ContainerOverrides = {},
): ObjectStorage | null {
  if ("objectStorage" in overrides) return overrides.objectStorage ?? null;
  if (
    !config.OBJECT_STORAGE_ENDPOINT ||
    !config.OBJECT_STORAGE_REGION ||
    !config.OBJECT_STORAGE_BUCKET ||
    !config.OBJECT_STORAGE_ACCESS_KEY_ID ||
    !config.OBJECT_STORAGE_SECRET_ACCESS_KEY
  ) {
    return null;
  }
  return new S3ObjectStorage({
    endpoint: config.OBJECT_STORAGE_ENDPOINT,
    region: config.OBJECT_STORAGE_REGION,
    bucket: config.OBJECT_STORAGE_BUCKET,
    accessKeyId: config.OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: config.OBJECT_STORAGE_SECRET_ACCESS_KEY,
    urlStyle: config.OBJECT_STORAGE_URL_STYLE,
  });
}

function objectStorageReadinessProbe(
  storage: ObjectStorage | null,
): ObjectStorageReadinessProbe | undefined {
  if (storage && "check" in storage && typeof storage.check === "function") {
    return storage as ObjectStorageReadinessProbe;
  }
  return undefined;
}

export function createContainer(config: ApiConfig, overrides: ContainerOverrides = {}) {
  const database = getDatabaseClient();
  const redis = new RedisClient(config.REDIS_URL ?? "redis://localhost:6379");
  const apiRateLimiter = new RedisApiRateLimiter(redis, {
    keyPrefix: "hooma:api-rate-limit:v1",
    limit: config.API_RATE_LIMIT_MAX_REQUESTS,
    windowSeconds: config.API_RATE_LIMIT_WINDOW_SECONDS,
  });
  const storage = objectStorage(config, overrides);
  const readinessService = new ReadinessService(
    new PrismaReadinessProbe(database),
    new RedisReadinessProbe(redis),
    objectStorageReadinessProbe(storage),
  );
  const platformAdminRepository = new PrismaPlatformAdminRepository(database);
  const platformAdminService = new PlatformAdminService(platformAdminRepository);
  const identityRepository = new PrismaIdentityRepository(database);
  const webSessionActivity = new PrismaWebSessionActivity(database);
  const identityService = new IdentityService(
    identityRepository,
    config,
    platformAdminService,
    webSessionActivity,
  );
  const canonicalUserReader = new PrismaCanonicalUserReader(database);
  const userPresentationReader = new PrismaUserPresentationReader(database);
  const userLastSeenReader = new PrismaUserLastSeenReader(database);
  const userNotificationRepository = new PrismaUserNotificationRepository(database);
  const userNotificationService = new UserNotificationService(userNotificationRepository);
  const passwordRecoveryRepository = new PrismaPasswordRecoveryRepository(database);
  const passwordRecoveryService = new PasswordRecoveryService(passwordRecoveryRepository, {
    notify: ({ userId, createdAt, expiresAt }) =>
      userNotificationService.notifyPasswordRecovery({
        recipientUserId: userId,
        createdAt,
        expiresAt,
      }),
    requireActive: ({ userId, notificationId, now }) =>
      userNotificationService.requireActivePasswordRecoveryNotification(
        userId,
        notificationId,
        now,
      ),
    markRead: async (userId, notificationId) => {
      await userNotificationService.markRead(userId, notificationId);
    },
  });
  const identityAdminService = new IdentityAdminService(
    new PrismaIdentityAdminRepository(database),
    platformAdminService,
    userNotificationService,
  );

  const placeRepository = new PrismaPlaceRepository(database);
  const placeImageResolver = new HttpExternalPlaceImageResolver();
  const placeService = new PlaceService(placeRepository, platformAdminService, placeImageResolver);
  const pitchRepository = new PrismaPitchRepository(database);
  const approvedPitchReader = new ApprovedPitchReader(pitchRepository);
  const pitchSuggestionService = new PitchSuggestionService(pitchRepository, placeImageResolver);
  const pitchOwnerService = new PitchOwnerService(
    pitchRepository,
    placeRepository,
    platformAdminService,
  );
  const pitchModerationService = new PitchModerationService(pitchRepository, platformAdminService);

  const gearUpRepository = new PrismaGearUpRepository(database);
  const gearUpProductRepository = new PrismaGearUpProductRepository(database);
  const gearUpProductMediaRepository = new PrismaGearUpProductMediaRepository(database);
  const gearUpService = new GearUpService(
    gearUpRepository,
    placeRepository,
    platformAdminService,
    placeImageResolver,
  );
  const gearUpProductService = new GearUpProductService(
    gearUpProductRepository,
    placeRepository,
    platformAdminService,
  );
  const gearUpProductMediaService = new GearUpProductMediaService(
    gearUpProductMediaRepository,
    gearUpProductRepository,
    placeRepository,
    platformAdminService,
    storage,
    new SharpGearUpProductImageProcessor(),
  );
  const gearUpSettingsService = new GearUpSettingsService(
    gearUpProductMediaRepository,
    platformAdminService,
  );

  const communityRepository = new PrismaCommunityRepository(database);
  const communityService = new CommunityService(communityRepository, platformAdminService);
  const athletesRepository = new PrismaAthletesRepository(database);
  const athletesService = new AthletesService(athletesRepository, userLastSeenReader);
  const athletesCalendarRepository = new PrismaAthletesCalendarRepository(database);
  const athletesCalendarService = new AthletesCalendarService(
    athletesService,
    athletesCalendarRepository,
    athletesCalendarRepository,
    storage,
    new SharpAthletesPhotoValidator(),
    new SharpAthletesPhotoOptimizer(),
  );
  const athletesPhotoRepository = new PrismaAthletesPhotoRepository(database);
  const athletesPhotoService = new AthletesPhotoService(
    athletesService,
    athletesPhotoRepository,
    athletesPhotoRepository,
    storage,
    new SharpAthletesPhotoValidator(),
    new SharpAthletesPhotoOptimizer(),
  );
  const teamRepository = new PrismaTeamRepository(database);
  const teamLifecycleRepository = new PrismaTeamLifecycleRepository(database);
  const teamService = new TeamService(
    teamRepository,
    communityService,
    teamLifecycleRepository,
    platformAdminService,
    approvedPitchReader,
  );
  const eventRepository = new PrismaEventRepository(database);
  const eventService = new EventService(
    eventRepository,
    communityService,
    placeService,
    approvedPitchReader,
  );
  const gamerGameRepository = new PrismaGamerGameRepository(database);
  const gamerProfileRepository = new PrismaGamerProfileRepository(database);
  const gamerChallengeRepository = new PrismaGamerChallengeRepository(database);
  const gamerEligibilityRepository = new PrismaGamerEligibilityRepository(database);
  const gamerMatchRepository = new PrismaGamerMatchRepository(database);
  const gamerService = new GamerService(
    gamerGameRepository,
    gamerProfileRepository,
    gamerChallengeRepository,
    gamerEligibilityRepository,
  );
  const gamerMatchService = new GamerMatchService(
    gamerGameRepository,
    gamerChallengeRepository,
    gamerMatchRepository,
    storage,
    platformAdminService,
  );
  const playRepository = new PrismaPlayPlayerListingRepository(database);
  const playService = new PlayService(playRepository, teamService, eventService);
  const requestRepository = new PrismaRequestRepository(database);
  const requestImageRepository = new PrismaRequestImageRepository(database);
  const helpTaxonomyRepository = new PrismaHelpTaxonomyRepository(database);
  const requestService = new RequestService(
    requestRepository,
    requestRepository,
    helpTaxonomyRepository,
    userPresentationReader,
  );
  const requestMediaService = new RequestMediaService(
    requestRepository,
    requestRepository,
    requestImageRepository,
    storage,
    new SharpRequestImageProcessor(),
  );
  const helpTaxonomyService = new HelpTaxonomyService(helpTaxonomyRepository);
  const rideOfferRepository = new PrismaRideOfferRepository(database);
  const rideRequestRepository = new PrismaRideRequestRepository(database);
  const rideReferenceReader = new PrismaRideReferenceReader(database);
  const rideVehiclePhotoRepository = new PrismaRideVehiclePhotoRepository(database);
  const rideCommunityInteractionRepository = new PrismaRideCommunityInteractionRepository(database);
  const rideStaticMapProvider =
    config.RIDE_STATIC_MAP_PROVIDER === "stadiamaps" && config.STADIA_MAPS_API_KEY
      ? new StadiaRideStaticMapProvider({
          apiKey: config.STADIA_MAPS_API_KEY,
          style: config.RIDE_STATIC_MAP_STYLE,
        })
      : null;
  const rideService = new RideService(
    rideOfferRepository,
    rideRequestRepository,
    rideOfferRepository,
    rideOfferRepository,
    rideReferenceReader,
    rideReferenceReader,
    rideReferenceReader,
    userPresentationReader,
    rideVehiclePhotoRepository,
    storage,
    rideStaticMapProvider,
  );
  const rideCommunityInteractionService = new RideCommunityInteractionService(
    rideCommunityInteractionRepository,
    rideReferenceReader,
    userPresentationReader,
  );
  const whistleRepository = new PrismaWhistleRepository(database);
  const whistleStore = new RedisWhistleStore(redis);
  const whistleService = new WhistleService(
    whistleRepository,
    whistleStore,
    communityService,
    eventService,
    gamerService,
    canonicalUserReader,
    athletesService,
    rideService,
    userNotificationService,
  );
  const discoveryRepository = new PrismaDiscoveryRepository(database);
  const discoveryService = new DiscoveryService(discoveryRepository);

  return {
    database,
    redis,
    apiRateLimiter,
    readinessService,
    identityService,
    passwordRecoveryService,
    identityAdminService,
    platformAdminService,
    placeService,
    approvedPitchReader,
    pitchSuggestionService,
    pitchOwnerService,
    pitchModerationService,
    gearUpService,
    gearUpProductService,
    gearUpProductMediaService,
    gearUpSettingsService,
    communityService,
    athletesService,
    athletesCalendarService,
    athletesPhotoService,
    teamService,
    eventService,
    gamerService,
    gamerMatchService,
    playService,
    requestService,
    requestMediaService,
    helpTaxonomyService,
    rideService,
    rideCommunityInteractionService,
    userNotificationService,
    whistleService,
    discoveryService,
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
