import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("PlaceImage belongs to the canonical Place schema with the existing cascade relation", () => {
  const schema = source("packages/database/prisma/schema.prisma");
  const cultural = source("packages/database/prisma/watch-cultural.prisma");
  const migration = source(
    "packages/database/prisma/migrations/20260826235000_watch_cultural_place_gallery/migration.sql",
  );

  assert.match(schema, /model Place \{[\s\S]*?images\s+PlaceImage\[\]/);
  assert.match(
    schema,
    /model PlaceImage \{[\s\S]*?placeId\s+String[\s\S]*?place\s+Place\s+@relation\(fields: \[placeId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(schema, /model PlaceImage \{[\s\S]*?@@unique\(\[placeId, sortOrder\]\)/);
  assert.match(schema, /model PlaceImage \{[\s\S]*?@@index\(\[placeId, sortOrder\]\)/);
  assert.doesNotMatch(cultural, /model PlaceImage/);

  assert.match(
    migration,
    /FOREIGN KEY \("placeId"\) REFERENCES "Place"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/,
  );
  assert.match(migration, /CREATE UNIQUE INDEX "PlaceImage_placeId_sortOrder_key"/);
  assert.match(migration, /CREATE INDEX "PlaceImage_placeId_sortOrder_idx"/);
});

test("PlaceImage stores an optional internal object key without rewriting historical rows", () => {
  const schema = source("packages/database/prisma/schema.prisma");

  assert.match(schema, /model PlaceImage \{[\s\S]*?objectKey\s+String\?/);
  assert.match(schema, /model PlaceImage \{[\s\S]*?@@index\(\[objectKey\]\)/);

  const migration = source(
    "packages/database/prisma/migrations/20261119170000_place_image_object_key/migration.sql",
  );
  assert.match(migration, /ALTER TABLE "PlaceImage" ADD COLUMN "objectKey" TEXT;/);
  assert.match(
    migration,
    /CREATE INDEX "PlaceImage_objectKey_idx" ON "PlaceImage"\("objectKey"\);/,
  );
  assert.doesNotMatch(migration, /UPDATE\s+"PlaceImage"/i);
  assert.doesNotMatch(migration, /NOT NULL/i);
});
