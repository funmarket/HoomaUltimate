import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { OutboxRepository } from "../apps/worker/src/outbox/outbox.repository.js";
import { type OutboxHandler, OutboxRunner } from "../apps/worker/src/outbox/outbox.runner.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Outbox worker integration tests");
}

const db = getDatabaseClient();
const topicPrefix = "test.outbox-worker";

async function cleanup(): Promise<void> {
  await db.outboxEvent.deleteMany({
    where: { topic: { startsWith: topicPrefix } },
  });
}

test("Outbox runner leaves events untouched when no handlers are registered", async () => {
  await cleanup();
  const event = await db.outboxEvent.create({
    data: { topic: `${topicPrefix}.idle`, payload: { ok: true } },
  });
  const runner = new OutboxRunner(new OutboxRepository(db), new Map());

  try {
    const result = await runner.runOnce();
    const stored = await db.outboxEvent.findUniqueOrThrow({
      where: { id: event.id },
    });

    assert.deepEqual(result, {
      claimed: 0,
      delivered: 0,
      retried: 0,
      failed: 0,
    });
    assert.equal(stored.status, "PENDING");
    assert.equal(stored.claimedAt, null);
  } finally {
    await cleanup();
  }
});

test("Outbox runner delivers a registered topic exactly through its handler", async () => {
  await cleanup();
  const topic = `${topicPrefix}.delivered`;
  const event = await db.outboxEvent.create({
    data: { topic, payload: { value: 7 } },
  });
  const handled: string[] = [];
  const handlers = new Map<string, OutboxHandler>([
    [
      topic,
      async (claimed) => {
        handled.push(claimed.id);
      },
    ],
  ]);
  const runner = new OutboxRunner(new OutboxRepository(db), handlers);

  try {
    const result = await runner.runOnce();
    const stored = await db.outboxEvent.findUniqueOrThrow({
      where: { id: event.id },
    });

    assert.deepEqual(handled, [event.id]);
    assert.deepEqual(result, {
      claimed: 1,
      delivered: 1,
      retried: 0,
      failed: 0,
    });
    assert.equal(stored.status, "DELIVERED");
    assert.ok(stored.deliveredAt);
    assert.equal(stored.claimedAt, null);
  } finally {
    await cleanup();
  }
});

test("Outbox runner releases a failed delivery with a bounded retry attempt", async () => {
  await cleanup();
  const topic = `${topicPrefix}.retry`;
  const event = await db.outboxEvent.create({
    data: { topic, payload: { ok: false } },
  });
  const handlers = new Map<string, OutboxHandler>([
    [
      topic,
      async () => {
        throw new Error("expected delivery failure");
      },
    ],
  ]);
  const runner = new OutboxRunner(new OutboxRepository(db), handlers, {
    random: () => 0.5,
  });

  try {
    const before = Date.now();
    const result = await runner.runOnce();
    const stored = await db.outboxEvent.findUniqueOrThrow({
      where: { id: event.id },
    });

    assert.deepEqual(result, {
      claimed: 1,
      delivered: 0,
      retried: 1,
      failed: 0,
    });
    assert.equal(stored.status, "PENDING");
    assert.equal(stored.attempts, 1);
    assert.equal(stored.claimedAt, null);
    assert.match(stored.lastError ?? "", /expected delivery failure/);
    assert.ok(stored.availableAt.getTime() >= before + 900);
  } finally {
    await cleanup();
  }
});

test("Outbox repository reclaims a stale PROCESSING lease", async () => {
  await cleanup();
  const topic = `${topicPrefix}.stale`;
  const oldClaim = new Date(Date.now() - 300_000);
  const event = await db.outboxEvent.create({
    data: {
      topic,
      payload: { stale: true },
      status: "PROCESSING",
      claimedAt: oldClaim,
    },
  });
  const repository = new OutboxRepository(db);
  const now = new Date();

  try {
    const claimed = await repository.claimAvailable({
      topics: [topic],
      now,
      staleBefore: new Date(now.getTime() - 120_000),
      limit: 10,
    });

    assert.equal(claimed.length, 1);
    assert.equal(claimed[0]?.id, event.id);
    assert.equal(claimed[0]?.claimedAt.getTime(), now.getTime());
  } finally {
    await cleanup();
  }
});
