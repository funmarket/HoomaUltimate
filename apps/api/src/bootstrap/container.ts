import type { ApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { S3ObjectStorage, type ObjectStorage } from "@hooma/storage";
import { RedisClient } from "../infrastructure/redis/redis-client.js";
import { IdentityService } from "../modules/identity/application/identity.service.js";
import { PrismaIdentityRepository } from "../modules/identity/infrastructure/prisma-identity.repository.js";
import { PrismaCanonicalUserReader } from "../modules/identity/infrastructure/prisma-canonical-user.reader.js";
import { PrismaUserPresentationReader } from "../modules/identity/infrastructure/prisma-user-presentation.reader.js";
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
import { AthletesService } from "../modules/athletes/application/athletes.service.js";
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
import { RideCommunityInteractionService } from "../modules/rides/application/ride-community-interaction.service.js";
import { RideService } from "../modules/rides/application/ride.service.js";
import { PrismaRideCommunityInteractionRepository } from "../modules/rides/infrastructure/prisma-ride-community-interaction.repository.js";
import {
  PrismaRideOfferRepository,
  PrismaRideRequestRepository,
} from "../modules/rides/infrastructure/prisma-ride.repository.js";
import { PrismaRideReferenceReader } from "../modules/rides/infrastructure/prisma-ride-reference.readers.js";
import { PrismaRideVehiclePhotoRepository } from "../modules/rides/infrastructure/prisma-ride-vehicle-photo.repository.js";
import { WhistleService } from "../modules/whistle/application/whistle.service.js";
import { PrismaWhistleRepository } from "../modules/whistle/infrastructure/prisma-whistle.repository.js";
import { RedisWhistleStore } from "../modules/whistle/infrastructure/redis-whistle-store.js";
import { DiscoveryService } from "../modules/discovery/application/discovery.service.js";
import { PrismaDiscoveryRepository } from "../modules/discovery/infrastructure/prisma-discovery.repository.js";
import { ReadinessService } from "../modules/system/application/readiness.service.js";
import { PrismaReadinessProbe } from "../modules/system/infrastructure/prisma-readiness.probe.js";
import { RedisReadinessProbe } from "../modules/system/infrastructure/redis-readiness.probe.js";

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
  });
}

export function createContainer(config: ApiConfig, overrides: ContainerOverrides = {}) {
  const database = getDatabaseClient();
  const redis = new RedisClient(config.REDIS_URL ?? "redis://localhost:6379");
  const storage = objectStorage(config, overrides);
  const readinessService = new ReadinessService(
    new PrismaReadinessProbe(database),
    new RedisReadinessProbe(redis),
  );
  const platformAdminRepository = new PrismaPlatformAdminRepository(database);
  const platformAdminService = new PlatformAdminService(platformAdminRepository);
  const identityRepository = new PrismaIdentityRepository(database);
  const identityService = new IdentityService(identityRepository, config, platformAdminService);
  const canonicalUserReader = new PrismaCanonicalUserReader(database);
  const userPresentationReader = new PrismaUserPresentationReader(database);

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

  const communityRepository = new PrismaCommunityRepository(database);
  const communityService = new CommunityService(communityRepository, platformAdminService);
  const athletesRepository = new PrismaAthletesRepository(database);
  const athletesService = new AthletesService(athletesRepository);
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
  const rideOfferRepository = new PrismaRideOfferRepository(database);
  const rideRequestRepository = new PrismaRideRequestRepository(database);
  const rideReferenceReader = new PrismaRideReferenceReader(database);
  const rideVehiclePhotoRepository = new PrismaRideVehiclePhotoRepository(database);
  const rideCommunityInteractionRepository = new PrismaRideCommunityInteractionRepository(database);
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
  );
  const discoveryRepository = new PrismaDiscoveryRepository(database);
  const discoveryService = new DiscoveryService(discoveryRepository);

  return {
    database,
    redis,
    readinessService,
    identityService,
    platformAdminService,
    placeService,
    approvedPitchReader,
    pitchSuggestionService,
    pitchOwnerService,
    pitchModerationService,
    communityService,
    athletesService,
    teamService,
    eventService,
    gamerService,
    gamerMatchService,
    playService,
    rideService,
    rideCommunityInteractionService,
    whistleService,
    discoveryService,
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
