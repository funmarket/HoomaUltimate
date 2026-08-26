import type { ApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { RedisClient } from "../infrastructure/redis/redis-client.js";
import { IdentityService } from "../modules/identity/application/identity.service.js";
import { PrismaIdentityRepository } from "../modules/identity/infrastructure/prisma-identity.repository.js";
import { PrismaPlatformAdminRepository } from "../modules/platform-admin/infrastructure/prisma-platform-admin.repository.js";
import { PlatformAdminService } from "../modules/platform-admin/application/platform-admin.service.js";
import { PlaceService } from "../modules/places/application/place.service.js";
import { PlaceCapabilityService } from "../modules/places/application/place-capability.service.js";
import { PrismaPlaceRepository } from "../modules/places/infrastructure/prisma-place.repository.js";
import { PrismaPlaceCapabilityRepository } from "../modules/places/infrastructure/prisma-place-capability.repository.js";
import { CommunityService } from "../modules/communities/application/community.service.js";
import { PrismaCommunityRepository } from "../modules/communities/infrastructure/prisma-community.repository.js";
import { TeamService } from "../modules/teams/application/team.service.js";
import { PrismaTeamLifecycleRepository } from "../modules/teams/infrastructure/prisma-team-lifecycle.repository.js";
import { PrismaTeamRepository } from "../modules/teams/infrastructure/prisma-team.repository.js";
import { EventService } from "../modules/events/application/event.service.js";
import { PrismaEventRepository } from "../modules/events/infrastructure/prisma-event.repository.js";
import { GamerService } from "../modules/gamers/application/gamer.service.js";
import { PrismaGamerChallengeRepository } from "../modules/gamers/infrastructure/prisma-gamer-challenge.repository.js";
import { PrismaGamerEligibilityRepository } from "../modules/gamers/infrastructure/prisma-gamer-eligibility.repository.js";
import { PrismaGamerGameRepository } from "../modules/gamers/infrastructure/prisma-gamer-game.repository.js";
import { PrismaGamerProfileRepository } from "../modules/gamers/infrastructure/prisma-gamer-profile.repository.js";
import { PlayService } from "../modules/play/application/play.service.js";
import { PrismaPlayPlayerListingRepository } from "../modules/play/infrastructure/prisma-play.repository.js";
import { WhistleService } from "../modules/whistle/application/whistle.service.js";
import { PrismaWhistleRepository } from "../modules/whistle/infrastructure/prisma-whistle.repository.js";
import { RedisWhistleStore } from "../modules/whistle/infrastructure/redis-whistle-store.js";
import { DiscoveryService } from "../modules/discovery/application/discovery.service.js";
import { PrismaDiscoveryRepository } from "../modules/discovery/infrastructure/prisma-discovery.repository.js";
import { ReadinessService } from "../modules/system/application/readiness.service.js";
import { PrismaReadinessProbe } from "../modules/system/infrastructure/prisma-readiness.probe.js";
import { RedisReadinessProbe } from "../modules/system/infrastructure/redis-readiness.probe.js";

export function createContainer(config: ApiConfig) {
  const database = getDatabaseClient();
  const redis = new RedisClient(config.REDIS_URL ?? "redis://localhost:6379");
  const readinessService = new ReadinessService(
    new PrismaReadinessProbe(database),
    new RedisReadinessProbe(redis),
  );
  const platformAdminRepository = new PrismaPlatformAdminRepository(database);
  const platformAdminService = new PlatformAdminService(platformAdminRepository);
  const identityRepository = new PrismaIdentityRepository(database);
  const identityService = new IdentityService(identityRepository, config, platformAdminService);

  const placeRepository = new PrismaPlaceRepository(database);
  const placeCapabilityRepository = new PrismaPlaceCapabilityRepository(database);
  const placeService = new PlaceService(placeRepository, platformAdminService);
  const pitchService = new PlaceCapabilityService(
    "PITCH",
    placeCapabilityRepository,
    placeRepository,
    platformAdminService,
  );

  const communityRepository = new PrismaCommunityRepository(database);
  const communityService = new CommunityService(communityRepository, platformAdminService);
  const teamRepository = new PrismaTeamRepository(database);
  const teamLifecycleRepository = new PrismaTeamLifecycleRepository(database);
  const teamService = new TeamService(
    teamRepository,
    communityService,
    teamLifecycleRepository,
    platformAdminService,
  );
  const eventRepository = new PrismaEventRepository(database);
  const eventService = new EventService(eventRepository, communityService, placeService);
  const gamerGameRepository = new PrismaGamerGameRepository(database);
  const gamerProfileRepository = new PrismaGamerProfileRepository(database);
  const gamerChallengeRepository = new PrismaGamerChallengeRepository(database);
  const gamerEligibilityRepository = new PrismaGamerEligibilityRepository(database);
  const gamerService = new GamerService(
    gamerGameRepository,
    gamerProfileRepository,
    gamerChallengeRepository,
    gamerEligibilityRepository,
  );
  const playRepository = new PrismaPlayPlayerListingRepository(database);
  const playService = new PlayService(playRepository);
  const whistleRepository = new PrismaWhistleRepository(database);
  const whistleStore = new RedisWhistleStore(redis);
  const whistleService = new WhistleService(
    whistleRepository,
    whistleStore,
    communityService,
    eventService,
    gamerService,
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
    pitchService,
    communityService,
    teamService,
    eventService,
    gamerService,
    playService,
    whistleService,
    discoveryService,
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
