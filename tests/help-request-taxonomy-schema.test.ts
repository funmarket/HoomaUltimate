import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("HelpRequest schema expands to nullable sport-first taxonomy references without removing legacy fields", async () => {
  const requestsSchema = await readFile(
    "packages/database/prisma/requests.prisma",
    "utf8",
  );
  const taxonomySchema = await readFile(
    "packages/database/prisma/help-taxonomy.prisma",
    "utf8",
  );
  const migration = await readFile(
    "packages/database/prisma/migrations/20260922004000_help_request_taxonomy_expansion/migration.sql",
    "utf8",
  );

  assert.match(requestsSchema, /subcategoryId\s+String\?/);
  assert.match(requestsSchema, /needId\s+String\?/);
  assert.match(requestsSchema, /category\s+HelpCategory/);
  assert.match(requestsSchema, /itemKind\s+HelpItemKind\?/);
  assert.match(requestsSchema, /@@index\(\[subcategoryId, status, createdAt\]\)/);
  assert.match(requestsSchema, /@@index\(\[needId, status, createdAt\]\)/);

  assert.match(taxonomySchema, /@@unique\(\[id, sport\]\)/);
  assert.match(taxonomySchema, /@@unique\(\[id, subcategoryId\]\)/);

  assert.match(migration, /ADD COLUMN "subcategoryId" TEXT/);
  assert.match(migration, /ADD COLUMN "needId" TEXT/);
  assert.match(migration, /HelpRequest_subcategoryId_fkey/);
  assert.match(migration, /HelpRequest_needId_fkey/);
  assert.match(migration, /HelpRequest_subcategoryId_sport_fkey/);
  assert.match(migration, /HelpRequest_needId_subcategoryId_fkey/);
  assert.match(migration, /HelpRequest_subcategory_requires_sport_check/);
  assert.match(migration, /HelpRequest_need_requires_subcategory_check/);
  assert.doesNotMatch(migration, /UPDATE\s+"HelpRequest"/i);
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+"HelpRequest"/i);
});
