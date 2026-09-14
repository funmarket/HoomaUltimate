import assert from "node:assert/strict";
import test from "node:test";
import type { WhistleCleanupDatabase } from "../apps/worker/src/whistle/whistle-cleanup.js";
import { cleanupExpiredWhistles } from "../apps/worker/src/whistle/whistle-cleanup.js";

test("worker cleanup deletes expired Whistle metadata in a bounded batch", async () => {
  const seen: string[] = [];
  const database = {
    $executeRaw: async (query: { readonly strings?: readonly string[] }) => {
      seen.push(query.strings?.join(" ") ?? "");
      return 17;
    },
  } as unknown as WhistleCleanupDatabase;

  const result = await cleanupExpiredWhistles(database, new Date("2026-09-14T20:00:00.000Z"), 750);

  assert.deepEqual(result, { deletedMetadata: 17 });
  assert.match(seen[0] ?? "", /WITH expired/);
  assert.match(seen[0] ?? "", /LIMIT/);
  assert.match(seen[0] ?? "", /DELETE FROM "WhistleMetadata"/);
});
