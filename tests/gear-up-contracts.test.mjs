import assert from "node:assert/strict";
import test from "node:test";
import * as Contracts from "@hooma/contracts";
function runtimeSchema(name) {
  const value = Contracts[name];
  assert.equal(typeof value?.safeParse, "function", `${name} is exported`);
  return value;
}
function succeeds(schema, input) {
  return schema.safeParse(input).success;
}
test("Gear Up shop accepts Sportswear, Gear, or both", () => {
  const schema = runtimeSchema("gearUpShopSuggestionSchema");
  const place = {
    name: "Tunis Football Store",
    address: "10 Sports Street",
    submissionOrigin: "OWNER",
  };
  const shop = {
    sports: ["FOOTBALL"],
    categories: ["JERSEYS_KITS"],
  };
  const sportswear = { place, shop: { ...shop, offerTypes: ["SPORTSWEAR"] } };
  const gear = { place, shop: { ...shop, offerTypes: ["GEAR"] } };
  const both = { place, shop: { ...shop, offerTypes: ["SPORTSWEAR", "GEAR"] } };
  const empty = { place, shop: { ...shop, offerTypes: [], sports: [] } };
  const noCategories = {
    place,
    shop: { ...shop, offerTypes: ["SPORTSWEAR"], categories: [] },
  };
  assert.equal(succeeds(schema, sportswear), true);
  assert.equal(succeeds(schema, gear), true);
  assert.equal(succeeds(schema, both), true);
  assert.equal(succeeds(schema, empty), false);
  assert.equal(succeeds(schema, noCategories), false);
});
test("Gear Up product supports optional price and governed taxonomy", () => {
  const schema = runtimeSchema("gearUpProductCreateSchema");
  const product = {
    title: "Club Jersey 2026",
    brand: "HOOMA Sports",
    description: "Official-style football jersey from the local shop.",
    sports: ["FOOTBALL"],
    category: "JERSEYS_KITS",
    price: null,
    currency: "TND",
  };
  assert.equal(succeeds(schema, product), true);
  assert.equal(succeeds(schema, { ...product, price: 349 }), true);
  assert.equal(succeeds(schema, { ...product, sports: [] }), false);
  assert.equal(succeeds(schema, { ...product, price: -1 }), false);
});
test("Gear Up image limit is bounded from 1 through 10", () => {
  const schema = runtimeSchema("gearUpSettingsUpdateSchema");
  assert.equal(succeeds(schema, { productImageLimit: 1 }), true);
  assert.equal(succeeds(schema, { productImageLimit: 3 }), true);
  assert.equal(succeeds(schema, { productImageLimit: 10 }), true);
  assert.equal(succeeds(schema, { productImageLimit: 0 }), false);
  assert.equal(succeeds(schema, { productImageLimit: 11 }), false);
});

test("Gear Up discovery query governs source, offer, sport and category filters", () => {
  const schema = runtimeSchema("gearUpListQuerySchema");
  assert.equal(
    succeeds(schema, {
      source: "FANHUB",
      offer: "GEAR",
      sport: "FOOTBALL",
      category: "BALLS",
      q: "football",
      city: "Tunis",
      houma: "Centre",
      limit: 30,
    }),
    true,
  );
  assert.equal(succeeds(schema, { source: "OTHER" }), false);
  assert.equal(succeeds(schema, { offer: "BOTH" }), false);
  assert.equal(succeeds(schema, { sport: "SOCCER" }), false);
  assert.equal(succeeds(schema, { limit: 101 }), false);
});
