import assert from "node:assert/strict";
import test from "node:test";
import {
  expireDueRequests,
  type RequestExpiryDatabase,
} from "../apps/worker/src/requests/request-expiry.js";

test("Request expiry Worker expires only due mutable Requests at one cutoff", async () => {
  const now = new Date("2026-09-21T16:00:00.000Z");
  const calls: unknown[] = [];
  const database = {
    helpRequest: {
      updateMany: async (args: unknown) => {
        calls.push(args);
        return { count: 2 };
      },
    },
  } as unknown as RequestExpiryDatabase;

  const result = await expireDueRequests(database, now);

  assert.deepEqual(result, { expiredRequests: 2 });
  assert.deepEqual(calls, [
    {
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        expiresAt: { not: null, lte: now },
      },
      data: { status: "EXPIRED" },
    },
  ]);
});

test("Request expiry Worker is repeat-safe after matching Requests become terminal", async () => {
  const now = new Date("2026-09-21T16:00:00.000Z");
  let sweep = 0;
  const database = {
    helpRequest: {
      updateMany: async () => ({ count: sweep++ === 0 ? 2 : 0 }),
    },
  } as unknown as RequestExpiryDatabase;

  assert.deepEqual(await expireDueRequests(database, now), { expiredRequests: 2 });
  assert.deepEqual(await expireDueRequests(database, now), { expiredRequests: 0 });
});
