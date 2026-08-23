import type { ApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { IdentityService } from "../modules/identity/application/identity.service.js";
import { PrismaIdentityRepository } from "../modules/identity/infrastructure/prisma-identity.repository.js";
import { PrismaPlatformAdminRepository } from "../modules/platform-admin/infrastructure/prisma-platform-admin.repository.js";
import { PlatformAdminService } from "../modules/platform-admin/application/platform-admin.service.js";
import { CommunityService } from "../modules/communities/application/community.service.js";
import { PrismaCommunityRepository } from "../modules/communities/infrastructure/prisma-community.repository.js";
import { TeamService } from "../modules/teams/application/team.service.js";
import { PrismaTeamRepository } from "../modules/teams/infrastructure/prisma-team.repository.js";
import { EventService } from "../modules/events/application/event.service.js";
import { PrismaEventRepository } from "../modules/events/infrastructure/prisma-event.repository.js";
import { GamerService } from "../modules/gamers/application/gamer.service.js";
import { PrismaGamerGameRepository } from "../modules/gamers/infrastructure/prisma-gamer-game.repository.js";
import { PrismaGamerProfileRepository } from "../modules/gamers/infrastructure/prisma-gamer-profile.repository.js";
import { PlayService } from "../modules/play/application/play.service.js";
import { PrismaPlayPlayerListingRepository } from "../modules/play/infrastructure/prisma-play.repository.js";
import { WhistleService } from "../modules/whistle/application/whistle.service.js";
import { PrismaWhistleRepository } from "../modules/whistle/infrastructure/prisma-whistle.repository.js";
import { RedisWhistleStore } from "../modules/whistle/infrastructure/redis-whistle-store.js";

export function createContainer(config: ApiConfig) {
  const database = getDatabaseClient();
  const identityRepository = new PrismaIdentityRepository(database);
  const identityService = new IdentityService(identityRepository, config);
  const platformAdminRepository = new PrismaPlatformAdminRepository(database);
  const platformAdminService = new PlatformAdminService(platformAdminRepository);
  const communityRepository = new PrismaCommunityRepository(database);
  const communityService = new CommunityService(communityRepository);
  const teamRepository = new PrismaTeamRepository(database);
  const teamService = new TeamService(teamRepository, communityService);
  const eventRepository = new PrismaEventRepository(database);
  const eventService = new EventService(eventRepository, communityService);
  const gamerGameRepository = new PrismaGamerGameRepository(database);
  const gamerProfileRepository = new PrismaGamerProfileRepository(database);
  const gamerService = new GamerService(gamerGameRepository, gamerProfileRepository);
  const playRepository = new PrismaPlayPlayerListingRepository(database);
  const playService = new PlayService(playRepository);
  const whistleRepository = new PrismaWhistleRepository(database);
  const whistleStore = new RedisWhistleStore(config.REDIS_URL ?? "redis://localhost:6379");
  const whistleService = new WhistleService(
    whistleRepository,
    whistleStore,
    communityService,
    eventService,
  );

  return {
    database,
    identityService,
    platformAdminService,
    communityService,
    teamService,
    eventService,
    gamerService,
    playService,
    whistleService,
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
