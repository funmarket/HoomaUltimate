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

  return { database, identityService, platformAdminService, communityService, teamService, eventService };
}

export type AppContainer = ReturnType<typeof createContainer>;
