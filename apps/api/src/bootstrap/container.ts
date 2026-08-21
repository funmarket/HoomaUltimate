import type { ApiConfig } from "@hooma/config";
import { getDatabaseClient } from "@hooma/database";
import { IdentityService } from "../modules/identity/application/identity.service.js";
import { PrismaIdentityRepository } from "../modules/identity/infrastructure/prisma-identity.repository.js";

export function createContainer(config: ApiConfig) {
  const database = getDatabaseClient();
  const identityRepository = new PrismaIdentityRepository(database);
  const identityService = new IdentityService(identityRepository, config);

  return { database, identityService };
}

export type AppContainer = ReturnType<typeof createContainer>;
