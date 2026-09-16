import assert from "node:assert/strict";
import test from "node:test";
import type { ApiConfig } from "@hooma/config";
import type { PrismaClient } from "@hooma/database";
import { IdentityService } from "../apps/api/src/modules/identity/application/identity.service.js";
import type {
  IdentityRepository,
} from "../apps/api/src/modules/identity/application/identity.repository.js";
import {
  PrismaIdentityRepository,
} from "../apps/api/src/modules/identity/infrastructure/prisma-identity.repository.js";

const meRecord = {
  id: "user-1",
  presentation: {
    username: "runner",
    displayName: "Runner",
    photoUrl: null,
    bio: null,
  },
  platformRoles: [] as const,
  managerCapabilities: [] as const,
  communities: [],
  athletesCommunities: [
    {
      id: "ath-1",
      name: "Tunis Runners",
      slug: "tunis-runners",
      role: "MODERATOR" as const,
    },
  ],
  teams: [],
};

test(
  "IdentityService.me returns Athletes publisher contexts from the account source of truth",
  async () => {
    const repository = {
      findMe: async () => meRecord,
    } as unknown as IdentityRepository;
    const service = new IdentityService(repository, {} as ApiConfig);

    const result = await service.me("user-1", ["web"]);

    assert.deepEqual(result.athletesCommunities, meRecord.athletesCommunities);
  },
);

test(
  "PrismaIdentityRepository.findMe reads active Athletes memberships and projects community identity",
  async () => {
    let capturedQuery: unknown;
    const db = {
      user: {
        findUnique: async (query: unknown) => {
          capturedQuery = query;
          return {
            id: "user-1",
            presentation: meRecord.presentation,
            platformRoles: [],
            appManagerGrants: [],
            communityMemberships: [],
            athletesMemberships: [
              {
                role: "MODERATOR",
                athletesCommunity: {
                  id: "ath-1",
                  name: "Tunis Runners",
                  slug: "tunis-runners",
                },
              },
            ],
            teamPlayers: [],
            teamResponsibilities: [],
            teamCapabilityGrants: [],
          };
        },
      },
    } as unknown as PrismaClient;
    const repository = new PrismaIdentityRepository(db);

    const result = await repository.findMe("user-1");
    const query = capturedQuery as {
      select?: {
        athletesMemberships?: {
          where?: { leftAt?: null };
          select?: {
            role?: boolean;
            athletesCommunity?: { select?: Record<string, boolean> };
          };
        };
      };
    };

    assert.deepEqual(query.select?.athletesMemberships?.where, { leftAt: null });
    assert.equal(query.select?.athletesMemberships?.select?.role, true);
    assert.deepEqual(
      query.select?.athletesMemberships?.select?.athletesCommunity?.select,
      {
        id: true,
        name: true,
        slug: true,
      },
    );
    assert.deepEqual(result?.athletesCommunities, meRecord.athletesCommunities);
  },
);
