import type { ApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { IdentityService } from "../modules/identity/application/identity.service.js";
import { PrismaIdentityRepository } from "../modules/identity/infrastructure/prisma-identity.repository.js";
import { PrismaPlatformAdminRepository } from "../modules/platform-admin/infrastructure/prisma-platform-admin.repository.js";
import { PlatformAdminService } from "../modules/platform-admin/application/platform-admin.service.js";

export function createContainer(config: ApiConfig) {
  const database = getDatabaseClient();
  const identityRepository = new PrismaIdentityRepository(database);
  const identityService = new IdentityService(identityRepository, config);
  const platformAdminRepository = new PrismaPlatformAdminRepository(database);
  const platformAdminService = new PlatformAdminService(platformAdminRepository);

  return { database, identityService, platformAdminService };
}

export type AppContainer = ReturnType<typeof createContainer>;
