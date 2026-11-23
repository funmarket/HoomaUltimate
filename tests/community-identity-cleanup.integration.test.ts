import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { COMMUNITY_IDENTITY_MEDIA_RECONCILE_TOPIC } from "@hooma/contracts/communities";
import { getDatabaseClient } from "@hooma/database";
import { createCommunityIdentityMediaCleanupHandler } from "../apps/worker/src/communities/community-identity-media-cleanup.js";
import { OutboxRepository } from "../apps/worker/src/outbox/outbox.repository.js";
import { OutboxRunner } from "../apps/worker/src/outbox/outbox.runner.js";

const db = getDatabaseClient();
const topic = COMMUNITY_IDENTITY_MEDIA_RECONCILE_TOPIC;

async function fixture() {
  const user = await db.user.create({ data: {} });
  const community = await db.community.create({
    data: {
      slug: `step24-worker-${randomUUID()}`,
      name: "Step 24 cleanup",
      createdByUserId: user.id,
    },
  });
  const cleanup = async () => {
    await db.outboxEvent.deleteMany({ where: { aggregateId: community.id } });
    await db.community.delete({ where: { id: community.id } });
    await db.user.delete({ where: { id: user.id } });
  };
  return { community, user, cleanup };
}

function validPayload(communityId: string, slot: "logo" | "banner", mediaId = randomUUID()) {
  return {
    communityId,
    mediaId,
    slot,
    objectKey: `staging/media/v1/community-${slot}/${communityId}/${mediaId}/master.webp`,
  };
}

for (const slot of ["logo", "banner"] as const) {
  test(`${slot} cleanup protects current references and removes only orphaned typed masters`, async () => {
    const f = await fixture();
    const removed: string[] = [];
    const payload = validPayload(f.community.id, slot);
    try {
      await db.community.update({
        where: { id: f.community.id },
        data:
          slot === "logo"
            ? {
                logoMediaId: payload.mediaId,
                logoObjectKey: payload.objectKey,
                logoContentType: "image/webp",
                logoSizeBytes: 3,
              }
            : {
                bannerMediaId: payload.mediaId,
                bannerObjectKey: payload.objectKey,
                bannerContentType: "image/webp",
                bannerSizeBytes: 3,
              },
      });
      const handler = createCommunityIdentityMediaCleanupHandler(
        db,
        {
          remove: async (key: string) => {
            removed.push(key);
          },
        },
        "staging",
      );
      const event = { id: payload.mediaId, topic, payload };
      await handler(event);
      assert.deepEqual(removed, []);
      await db.community.update({
        where: { id: f.community.id },
        data:
          slot === "logo"
            ? {
                logoMediaId: null,
                logoObjectKey: null,
                logoContentType: null,
                logoSizeBytes: null,
              }
            : {
                bannerMediaId: null,
                bannerObjectKey: null,
                bannerContentType: null,
                bannerSizeBytes: null,
              },
      });
      await handler(event);
      assert.deepEqual(removed, [payload.objectKey]);
    } finally {
      await f.cleanup();
    }
  });
}

test("Community cleanup rejects wrong topic, event ID, scope, namespace, identity and suffix", async () => {
  const f = await fixture();
  const removed: string[] = [];
  try {
    const handler = createCommunityIdentityMediaCleanupHandler(
      db,
      {
        remove: async (key: string) => {
          removed.push(key);
        },
      },
      "staging",
    );
    const original = validPayload(f.community.id, "logo");
    const invalidKeys = [
      original.objectKey.replace("staging/", "production/"),
      original.objectKey.replace("community-logo/", "request-photo/"),
      original.objectKey.replace(f.community.id, "another-community"),
      original.objectKey.replace(original.mediaId, "another-media"),
      original.objectKey.replace("master.webp", "thumb.webp"),
      `${original.objectKey}/nested`,
      `staging/media/v1/community-logo/${f.community.id}/../master.webp`,
      "https://images.example.org/external.png",
    ];
    for (const objectKey of invalidKeys) {
      await assert.rejects(
        handler({ id: original.mediaId, topic, payload: { ...original, objectKey } }),
        /outside the Community identity ownership boundary/,
      );
    }
    await assert.rejects(
      handler({ id: "wrong-id", topic, payload: original }),
      /outside the Community identity ownership boundary/,
    );
    await assert.rejects(
      handler({ id: original.mediaId, topic: "other.topic", payload: original }),
      /outside the Community identity ownership boundary/,
    );
    await assert.rejects(
      handler({
        id: original.mediaId,
        topic,
        payload: {
          ...original,
          communityId: "../traversal",
          objectKey: "staging/media/v1/community-logo/../traversal/master.webp",
        },
      }),
      /outside the Community identity ownership boundary/,
    );
    assert.deepEqual(removed, []);
  } finally {
    await f.cleanup();
  }
});

test("Community Worker uses canonical Outbox retries and marks successful orphan deletion delivered", async () => {
  const f = await fixture();
  const payload = validPayload(f.community.id, "banner");
  let calls = 0;
  try {
    await db.outboxEvent.create({
      data: {
        id: payload.mediaId,
        topic,
        aggregateType: "CommunityIdentityMedia",
        aggregateId: f.community.id,
        payload,
        availableAt: new Date(Date.now() - 1_000),
      },
    });
    const handler = createCommunityIdentityMediaCleanupHandler(
      db,
      {
        remove: async (key: string) => {
          assert.equal(key, payload.objectKey);
          calls++;
          if (calls === 1) throw Error("transient object storage failure");
        },
      },
      "staging",
    );
    const runner = new OutboxRunner(new OutboxRepository(db), new Map([[topic, handler]]), {
      random: () => 0,
    });
    const first = await runner.runOnce();
    assert.deepEqual(first, { claimed: 1, delivered: 0, retried: 1, failed: 0 });
    const retry = await db.outboxEvent.findUniqueOrThrow({ where: { id: payload.mediaId } });
    assert.equal(retry.status, "PENDING");
    assert.equal(retry.attempts, 1);
    await db.outboxEvent.update({
      where: { id: payload.mediaId },
      data: { availableAt: new Date(Date.now() - 1_000) },
    });
    const second = await runner.runOnce();
    assert.deepEqual(second, { claimed: 1, delivered: 1, retried: 0, failed: 0 });
    const delivered = await db.outboxEvent.findUniqueOrThrow({
      where: { id: payload.mediaId },
    });
    assert.equal(delivered.status, "DELIVERED");
    assert.equal(calls, 2);
  } finally {
    await f.cleanup();
  }
});
