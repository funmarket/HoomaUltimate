import assert from "node:assert/strict";
import test from "node:test";
import type { AthletesService } from "../apps/api/src/modules/athletes/application/athletes.service.js";
import type { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import type { EventService } from "../apps/api/src/modules/events/application/event.service.js";
import type { GamerService } from "../apps/api/src/modules/gamers/application/gamer.service.js";
import type { CanonicalUserReader } from "../apps/api/src/modules/identity/application/canonical-user.reader.js";
import type {
  WhistleMetadataRecord,
  WhistleRepository,
} from "../apps/api/src/modules/whistle/application/whistle.repository.js";
import { WhistleService } from "../apps/api/src/modules/whistle/application/whistle.service.js";
import type { WhistleTransientStore } from "../apps/api/src/modules/whistle/application/whistle.store.js";

function metadata(id: string): WhistleMetadataRecord {
  return {
    id,
    authorUserId: `author-${id}`,
    contextType: "COMMUNITY",
    contextId: "community-1",
    createdAt: new Date("2026-08-25T12:00:00.000Z"),
    expiresAt: new Date("2026-08-26T00:00:00.000Z"),
  };
}

function repositoryStub(overrides: Partial<WhistleRepository> = {}): WhistleRepository {
  return {
    async createWithDailyQuota() {
      throw new Error("not used");
    },
    async quotaUsed() {
      return 3;
    },
    async listActive() {
      return [];
    },
    async deleteExpired() {
      return 0;
    },
    ...overrides,
  };
}

function storeStub(overrides: Partial<WhistleTransientStore> = {}): WhistleTransientStore {
  return {
    async putBody() {},
    async getBodies() {
      return new Map();
    },
    async deleteBody() {},
    ...overrides,
  };
}

function serviceWith(options: {
  repository?: Partial<WhistleRepository>;
  store?: Partial<WhistleTransientStore>;
  communities?: Partial<CommunityService>;
  events?: Partial<EventService>;
  gamers?: Partial<GamerService>;
  users?: Partial<CanonicalUserReader>;
  athletes?: Partial<AthletesService>;
}) {
  return new WhistleService(
    repositoryStub(options.repository),
    storeStub(options.store),
    { requireMember: async () => undefined, ...options.communities } as unknown as CommunityService,
    { requireMemberContent: async () => undefined, ...options.events } as unknown as EventService,
    { ...options.gamers } as unknown as GamerService,
    { ...options.users } as unknown as CanonicalUserReader,
    {
      requireMemberContent: async () => undefined,
      ...options.athletes,
    } as unknown as AthletesService,
  );
}

test("Whistle list hydrates all transient bodies with one batch read", async () => {
  const rows = [metadata("one"), metadata("two"), metadata("expired-body")];
  const batchCalls: string[][] = [];
  const service = serviceWith({
    repository: {
      async listActive() {
        return rows;
      },
    },
    store: {
      async getBodies(ids) {
        batchCalls.push([...ids]);
        return new Map([
          ["one", "first whistle"],
          ["two", "second whistle"],
        ]);
      },
    },
  });

  const result = await service.list("viewer-1", "COMMUNITY", "community-1");

  assert.deepEqual(batchCalls, [["one", "two", "expired-body"]]);
  assert.deepEqual(
    result.items.map((item) => [item.id, item.body]),
    [
      ["one", "first whistle"],
      ["two", "second whistle"],
    ],
  );
  assert.equal(result.remainingToday, 8);
});

test("Athletes Whistle authorizes through active Athletes membership and uses shared quota", async () => {
  const calls: Array<[string, string]> = [];
  const created: Array<{ contextType: string; contextId: string; dailyLimit: number }> = [];
  const service = serviceWith({
    athletes: {
      async requireMemberContent(userId: string, athletesCommunityId: string) {
        calls.push([userId, athletesCommunityId]);
      },
    },
    repository: {
      async createWithDailyQuota(input) {
        created.push({
          contextType: input.contextType,
          contextId: input.contextId,
          dailyLimit: input.dailyLimit,
        });
        return {
          id: input.id,
          authorUserId: input.authorUserId,
          contextType: input.contextType,
          contextId: input.contextId,
          createdAt: input.createdAt,
          expiresAt: input.expiresAt,
        };
      },
      async quotaUsed() {
        return 1;
      },
    },
  });

  const result = await service.create(
    "athlete-1",
    "ATHLETES",
    "athletes-community-1",
    "🏃🏽‍♀️".repeat(33),
  );

  assert.deepEqual(calls, [["athlete-1", "athletes-community-1"]]);
  assert.deepEqual(created, [
    { contextType: "ATHLETES", contextId: "athletes-community-1", dailyLimit: 11 },
  ]);
  assert.equal(result.remainingToday, 10);
});
