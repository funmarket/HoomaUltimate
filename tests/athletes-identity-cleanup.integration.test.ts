import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ATHLETES_IDENTITY_MEDIA_RECONCILE_TOPIC as topic } from "@hooma/contracts/athletes";
import { getDatabaseClient } from "@hooma/database";
import { buildMediaObjectKey } from "@hooma/media-processing";
import {
  PrismaAthletesRepository,
} from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes.repository.js";
import {
  createAthletesIdentityMediaCleanupHandler,
} from "../apps/worker/src/athletes/athletes-identity-media-cleanup.js";
import { OutboxRepository } from "../apps/worker/src/outbox/outbox.repository.js";
import { OutboxRunner } from "../apps/worker/src/outbox/outbox.runner.js";

const db = getDatabaseClient();
const scope = "staging" as const;

async function fixture() {
  const user = await db.user.create({ data: {} });
  const community = await new PrismaAthletesRepository(db).createWithFounder(user.id, {
    name: "Identity cleanup " + randomUUID(),
    sport: "RUNNING",
    visibility: "PUBLIC",
    joinPolicy: "OPEN",
  });
  const cleanup = async () => {
    await db.outboxEvent.deleteMany({ where: { aggregateId: community.id } });
    await db.athletesCommunity.delete({ where: { id: community.id } });
    await db.user.delete({ where: { id: user.id } });
  };
  return { community, cleanup };
}

function validPayload(athletesCommunityId: string, slot: "logo" | "banner") {
  const mediaId = randomUUID();
  const objectKey = buildMediaObjectKey({
    scope,
    namespace:
      slot === "logo"
        ? "ATHLETES_COMMUNITY_LOGO"
        : "ATHLETES_COMMUNITY_BANNER",
    ownerId: athletesCommunityId,
    mediaId,
    variant: "master",
  });
  return { athletesCommunityId, mediaId, slot, objectKey };
}

for (const slot of ["logo", "banner"] as const) {
  test("identity cleanup protects " + slot + " refs and removes orphans", async () => {
    const f = await fixture();
    const removed: string[] = [];
    const payload = validPayload(f.community.id, slot);
    try {
      await db.athletesCommunity.update({
        where: { id: f.community.id },
        data:
          slot === "logo"
            ? { logoMediaId: payload.mediaId, logoObjectKey: payload.objectKey }
            : { bannerMediaId: payload.mediaId, bannerObjectKey: payload.objectKey },
      });
      const handler = createAthletesIdentityMediaCleanupHandler(
        db,
        { remove: async (key) => removed.push(key) },
        scope,
      );
      const event = { id: payload.mediaId, topic, payload };
      await handler(event);
      assert.deepEqual(removed, []);

      await db.athletesCommunity.update({
        where: { id: f.community.id },
        data:
          slot === "logo"
            ? { logoMediaId: null, logoObjectKey: null }
            : { bannerMediaId: null, bannerObjectKey: null },
      });
      await handler(event);
      assert.deepEqual(removed, [payload.objectKey]);
    } finally {
      await f.cleanup();
    }
  });
}

test("identity cleanup rejects bad metadata without deleting", async () => {
  const f = await fixture();
  const removed: string[] = [];
  try {
    const handler = createAthletesIdentityMediaCleanupHandler(
      db,
      { remove: async (key) => removed.push(key) },
      scope,
    );
    const original = validPayload(f.community.id, "logo");
    const invalidKeys = [
      original.objectKey.replace("staging/", "production/"),
      original.objectKey.replace("athletes-community-logo/", "community-logo/"),
      original.objectKey.replace(f.community.id, "another-community"),
      original.objectKey.replace(original.mediaId, "another-media"),
      original.objectKey.replace("master.webp", "thumb.webp"),
      original.objectKey + "/nested",
      "staging/media/v1/athletes-community-logo/" + f.community.id + "/../master.webp",
      "https://images.example.org/external.png",
    ];
    for (const objectKey of invalidKeys) {
      await assert.rejects(
        handler({ id: original.mediaId, topic, payload: { ...original, objectKey } }),
        /outside the upload ownership boundary/,
      );
    }
    await assert.rejects(
      handler({ id: "wrong-id", topic, payload: original }),
      /outside the upload ownership boundary/,
    );
    await assert.rejects(
      handler({ id: original.mediaId, topic: "other.topic", payload: original }),
      /outside the upload ownership boundary/,
    );
    await assert.rejects(
      handler({
        id: original.mediaId,
        topic,
        payload: { ...original, athletesCommunityId: "../traversal" },
      }),
      /outside the upload ownership boundary/,
    );
    assert.deepEqual(removed, []);
  } finally {
    await f.cleanup();
  }
});

test("identity cleanup retries durable Outbox events", async () => {
  const f = await fixture();
  const payload = validPayload(f.community.id, "banner");
  let calls = 0;
  try {
    await db.outboxEvent.create({
      data: {
        id: payload.mediaId,
        topic,
        aggregateType: "AthletesIdentityMedia",
        aggregateId: f.community.id,
        payload,
        availableAt: new Date(Date.now() - 1_000),
      },
    });
    const handler = createAthletesIdentityMediaCleanupHandler(
      db,
      {
        remove: async (key) => {
          assert.equal(key, payload.objectKey);
          calls += 1;
          if (calls === 1) throw new Error("transient object storage failure");
        },
      },
      scope,
    );
    const runner = new OutboxRunner(new OutboxRepository(db), new Map([[topic, handler]]), {
      random: () => 0,
    });
    assert.deepEqual(await runner.runOnce(), { claimed: 1, delivered: 0, retried: 1, failed: 0 });
    const retry = await db.outboxEvent.findUniqueOrThrow({ where: { id: payload.mediaId } });
    assert.equal(retry.status, "PENDING");
    assert.equal(retry.attempts, 1);
    await db.outboxEvent.update({
      where: { id: payload.mediaId },
      data: { availableAt: new Date(Date.now() - 1_000) },
    });
    assert.deepEqual(await runner.runOnce(), { claimed: 1, delivered: 1, retried: 0, failed: 0 });
    const delivered = await db.outboxEvent.findUniqueOrThrow({ where: { id: payload.mediaId } });
    assert.equal(delivered.status, "DELIVERED");
    assert.equal(calls, 2);
  } finally {
    await f.cleanup();
  }
});
