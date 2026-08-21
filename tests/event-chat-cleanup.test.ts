import assert from "node:assert/strict";
import test from "node:test";
import type { EventChatCleanupDatabase } from "../apps/worker/src/events/event-chat-cleanup.js";
import { cleanupExpiredEventChat } from "../apps/worker/src/events/event-chat-cleanup.js";

test("worker deletes expired Event chat messages and closed rooms using one cleanup cutoff", async () => {
  const now = new Date("2026-08-22T02:00:00.000Z");
  const seen: Date[] = [];
  const database = {
    eventChatMessage: {
      deleteMany: async ({ where }: { where: { expiresAt: { lte: Date } } }) => {
        seen.push(where.expiresAt.lte);
        return { count: 7 };
      }
    },
    eventChatRoom: {
      deleteMany: async ({ where }: { where: { closesAt: { lte: Date } } }) => {
        seen.push(where.closesAt.lte);
        return { count: 2 };
      }
    }
  } as unknown as EventChatCleanupDatabase;

  const result = await cleanupExpiredEventChat(database, now);

  assert.deepEqual(result, { deletedMessages: 7, deletedRooms: 2 });
  assert.equal(seen.length, 2);
  assert.equal(seen[0]?.toISOString(), now.toISOString());
  assert.equal(seen[1]?.toISOString(), now.toISOString());
});
