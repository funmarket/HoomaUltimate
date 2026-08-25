import assert from "node:assert/strict";
import test from "node:test";
import type { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
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

test("Whistle list hydrates all transient bodies with one batch read", async () => {
  const rows = [metadata("one"), metadata("two"), metadata("expired-body")];
  const repository: WhistleRepository = {
    async createWithDailyQuota() {
      throw new Error("not used");
    },
    async quotaUsed() {
      return 3;
    },
    async listActive() {
      return rows;
    },
    async deleteExpired() {
      return 0;
    },
  };

  const batchCalls: string[][] = [];
  const transientStore: WhistleTransientStore = {
    async putBody() {
      throw new Error("not used");
    },
    async getBodies(ids) {
      batchCalls.push([...ids]);
      return new Map([
        ["one", "first whistle"],
        ["two", "second whistle"],
      ]);
    },
    async deleteBody() {
      throw new Error("not used");
    },
  };

  const communities = {
    async requireMember() {},
  } as unknown as CommunityService;
  const service = new WhistleService(repository, transientStore, communities);

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
