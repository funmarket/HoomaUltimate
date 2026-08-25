import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Discovery index integration tests");
}

const db = getDatabaseClient();

const expectedIndexes = [
  "Event_discovery_published_startsAt_id_idx",
  "Event_discovery_published_endsAt_idx",
  "TeamGame_discovery_confirmed_scheduledAt_id_idx",
  "TeamGame_discovery_confirmed_endsAt_idx",
  "GamerChallenge_discovery_accepted_respondedAt_id_idx",
] as const;

test("HOOMA NOW database indexes are installed by migrations", async () => {
  const rows = await db.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN (
        'Event_discovery_published_startsAt_id_idx',
        'Event_discovery_published_endsAt_idx',
        'TeamGame_discovery_confirmed_scheduledAt_id_idx',
        'TeamGame_discovery_confirmed_endsAt_idx',
        'GamerChallenge_discovery_accepted_respondedAt_id_idx'
      )
    ORDER BY indexname ASC
  `;

  assert.deepEqual(
    rows.map((row) => row.indexname).sort(),
    [...expectedIndexes].sort(),
  );
});
