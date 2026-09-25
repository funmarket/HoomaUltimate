import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Gear Up has explicit Place discovery without duplicating canonical Place", () => {
  const gearUpSchemaPath = "packages/database/prisma/gear-up.prisma";
  const gearUpSchemaUrl = new URL(`../${gearUpSchemaPath}`, import.meta.url);
  const canonicalSchema = source("packages/database/prisma/schema.prisma");

  assert.equal(existsSync(gearUpSchemaUrl), true, "Gear Up must own a Prisma schema module");
  const gearUpSchema = source(gearUpSchemaPath);
  const discoveryEnum = /enum PlaceDiscoveryKind \{[\s\S]*?WATCH_SPOT[\s\S]*?GEAR_UP[\s\S]*?\}/;
  const placeDiscoveries = /model Place \{[\s\S]*?discoveries\s+PlaceDiscovery\[\]/;
  const gearUpShop = /model Place \{[\s\S]*?gearUpShop\s+GearUpShop\?/;
  const duplicatePlaceModel = /model (?:SportStore|ShopPlace|GearUpPlace)\s+\{/;

  assert.match(gearUpSchema, discoveryEnum);
  assert.match(canonicalSchema, placeDiscoveries);
  assert.match(canonicalSchema, gearUpShop);
  assert.doesNotMatch(gearUpSchema, duplicatePlaceModel);
});

test("Gear Up persistence owns shop, products, images and bounded settings", () => {
  const gearUpSchemaPath = "packages/database/prisma/gear-up.prisma";
  const gearUpSchemaUrl = new URL(`../${gearUpSchemaPath}`, import.meta.url);

  assert.equal(existsSync(gearUpSchemaUrl), true, "Gear Up must own a Prisma schema module");
  const schema = source(gearUpSchemaPath);

  assert.match(schema, /model PlaceDiscovery \{/);
  assert.match(schema, /@@id\(\[placeId, kind\]\)/);
  assert.match(schema, /model GearUpShop \{/);
  assert.match(schema, /placeId\s+String\s+@id/);
  assert.match(schema, /model GearUpProduct \{/);
  assert.match(schema, /price\s+Decimal\?/);
  assert.match(schema, /archivedAt\s+DateTime\?/);
  assert.match(schema, /model GearUpProductImage \{/);
  assert.match(schema, /@@unique\(\[productId, sortOrder\]\)/);
  assert.match(schema, /model GearUpSettings \{/);
  assert.match(schema, /productImageLimit\s+Int\s+@default\(3\)/);
});

test("Gear Up contracts are exported from the contracts package", () => {
  const contracts = source("packages/contracts/src/index.ts");
  assert.match(contracts, /export \* from "\.\/gear-up\.js";/);
});

test("canonical Place suggestion accepts explicit discovery classification", () => {
  const path = "apps/api/src/modules/places/boundary/canonical-place.persistence.ts";
  const canonicalPlace = source(path);

  assert.match(canonicalPlace, /PlaceDiscoveryKind/);
  assert.match(canonicalPlace, /discoveryKind/);
  assert.match(canonicalPlace, /placeDiscovery\.upsert/);
});
