import assert from "node:assert/strict";
import test from "node:test";
import type { AthletesService } from "../apps/api/src/modules/athletes/application/athletes.service.js";
import type { CommunityMemberAuthorizer } from "../apps/api/src/modules/communities/application/community-member.authorizer.js";
import type { EventMemberContentAuthorizer } from "../apps/api/src/modules/events/application/event-member-content.authorizer.js";
import type { GamerDirectWhistleContextResolver } from "../apps/api/src/modules/gamers/application/gamer-direct-whistle-context.resolver.js";
import type { CanonicalUserReader } from "../apps/api/src/modules/identity/application/canonical-user.reader.js";
import type { RideService } from "../apps/api/src/modules/rides/application/ride.service.js";
import type { UserNotificationService } from "../apps/api/src/modules/notifications/application/user-notification.service.js";
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
  communities?: Partial<CommunityMemberAuthorizer>;
  events?: Partial<EventMemberContentAuthorizer>;
  gamers?: Partial<GamerDirectWhistleContextResolver>;
  users?: Partial<CanonicalUserReader>;
  athletes?: Partial<AthletesService>;
  rides?: Partial<RideService>;
  notifications?: Partial<UserNotificationService>;
}) {
  return new WhistleService(
    repositoryStub(options.repository),
    storeStub(options.store),
    {
      requireMember: async () => undefined,
      ...options.communities,
    } as unknown as CommunityMemberAuthorizer,
    { requireMemberContent: async () => undefined, ...options.events },
    {
      resolveDirectWhistleContext: async () => {
        throw new Error("not used");
      },
      ...options.gamers,
    },
    { ...options.users } as unknown as CanonicalUserReader,
    {
      requireMemberContent: async () => undefined,
      ...options.athletes,
    } as unknown as AthletesService,
    {
      requireWhistleRead: async () => ({ ownerUserId: "ride-owner-1" }),
      requireWhistlePost: async () => ({ ownerUserId: "ride-owner-1" }),
      ...options.rides,
    } as unknown as RideService,
    {
      notifyWhistle: async () => undefined,
      ...options.notifications,
    } as unknown as UserNotificationService,
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

test("Ride Whistle authorizes through Ride domain and notifies owner without body", async () => {
  const rideCalls: Array<[string, string]> = [];
  const created: Array<{ contextType: string; contextId: string; dailyLimit: number }> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const service = serviceWith({
    rides: {
      async requireWhistlePost(userId: string, rideRequestId: string) {
        rideCalls.push([userId, rideRequestId]);
        return { ownerUserId: "ride-owner-1" };
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
    notifications: {
      async notifyWhistle(input: Record<string, unknown>) {
        notifications.push(input);
      },
    },
  });

  await service.create("rider-1", "RIDE", "ride-request-1", "I can help");

  assert.deepEqual(rideCalls, [["rider-1", "ride-request-1"]]);
  assert.deepEqual(created, [{ contextType: "RIDE", contextId: "ride-request-1", dailyLimit: 11 }]);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.recipientUserId, "ride-owner-1");
  assert.equal(notifications[0]?.actorUserId, "rider-1");
  assert.equal(notifications[0]?.contextType, "RIDE");
  assert.equal(notifications[0]?.contextId, "ride-request-1");
  assert.equal(Object.hasOwn(notifications[0] ?? {}, "body"), false);
});

test("direct User Whistle remains USER_DIRECT and notifies only recipient without body", async () => {
  const created: Array<{ contextType: string; contextId: string; dailyLimit: number }> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const service = serviceWith({
    users: {
      async findUserIdByUsername(username: string) {
        assert.equal(username, "target-user");
        return "target-user-id";
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
    notifications: {
      async notifyWhistle(input: Record<string, unknown>) {
        notifications.push(input);
      },
    },
  });

  await service.createDirectUser("sender-user-id", "target-user", "hello");

  assert.deepEqual(created, [
    { contextType: "USER_DIRECT", contextId: "sender-user-id:target-user-id", dailyLimit: 11 },
  ]);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.recipientUserId, "target-user-id");
  assert.equal(notifications[0]?.actorUserId, "sender-user-id");
  assert.equal(notifications[0]?.contextType, "USER_DIRECT");
  assert.equal(notifications[0]?.contextId, "sender-user-id:target-user-id");
  assert.equal(Object.hasOwn(notifications[0] ?? {}, "body"), false);
});

test("Community Whistle read and post delegate membership authorization through the narrow boundary", async () => {
  const calls: Array<[string, string]> = [];
  const service = serviceWith({
    communities: {
      async requireMember(communityId: string, userId: string) {
        calls.push([communityId, userId]);
      },
    },
    repository: {
      async createWithDailyQuota(input) {
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

  await service.list("reader-1", "COMMUNITY", "community-read-1");
  await service.create("poster-1", "COMMUNITY", "community-post-1", "hello");

  assert.deepEqual(calls, [
    ["community-read-1", "reader-1"],
    ["community-post-1", "poster-1"],
  ]);
});

test("Event Whistle read and post delegate member-content authorization through the Events boundary", async () => {
  const calls: Array<[string, string]> = [];
  const service = serviceWith({
    events: {
      async requireMemberContent(userId: string, eventId: string) {
        calls.push([userId, eventId]);
      },
    },
    repository: {
      async createWithDailyQuota(input) {
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

  await service.list("reader-1", "EVENT", "event-read-1");
  await service.create("poster-1", "EVENT", "event-post-1", "hello");

  assert.deepEqual(calls, [
    ["reader-1", "event-read-1"],
    ["poster-1", "event-post-1"],
  ]);
});

test("direct Gamer Whistle read and post use the Gamers-resolved context", async () => {
  const calls: Array<[string, string]> = [];
  const listed: Array<[string, string]> = [];
  const created: Array<[string, string]> = [];
  const resolvedContexts: Record<string, string> = {
    "target-profile-read": "game-read:profile-a:profile-b",
    "target-profile-post": "game-post:profile-c:profile-d",
  };
  const service = serviceWith({
    gamers: {
      async resolveDirectWhistleContext(userId: string, otherProfileId: string) {
        calls.push([userId, otherProfileId]);
        return resolvedContexts[otherProfileId]!;
      },
    },
    repository: {
      async listActive(contextType, contextId) {
        listed.push([contextType, contextId]);
        return [];
      },
      async createWithDailyQuota(input) {
        created.push([input.contextType, input.contextId]);
        return {
          id: input.id,
          authorUserId: input.authorUserId,
          contextType: input.contextType,
          contextId: input.contextId,
          createdAt: input.createdAt,
          expiresAt: input.expiresAt,
        };
      },
    },
  });

  await service.listDirectGamer("reader-1", "target-profile-read");
  await service.createDirectGamer("poster-1", "target-profile-post", "hello");

  assert.deepEqual(calls, [
    ["reader-1", "target-profile-read"],
    ["poster-1", "target-profile-post"],
  ]);
  assert.deepEqual(listed, [["GAMER_DIRECT", resolvedContexts["target-profile-read"]]]);
  assert.deepEqual(created, [["GAMER_DIRECT", resolvedContexts["target-profile-post"]]]);
});
