import assert from "node:assert/strict";
import test from "node:test";
import * as Contracts from "@hooma/contracts";
function runtimeSchema(name) {
  const value = Contracts[name];
  assert.ok(
    value && typeof value === "object" && typeof value.safeParse === "function",
    `${name} is exported`,
  );
  return value;
}
test("Gear Up shop accepts Sportswear, Gear, or both", () => {
  const schema = runtimeSchema("gearUpShopSuggestionSchema");
  const base = {
    place: {
      name: "Tunis Football Store",
      address: "10 Sports Street",
      submissionOrigin: "OWNER",
    },
    shop: {
      sports: ["FOOTBALL"],
      categories: ["JERSEYS_KITS"],
    },
  };
  for (const offerTypes of [["SPORTSWEAR"], ["GEAR"], ["SPORTSWEAR", "GEAR"]]) {
    assert.equal(
      schema.safeParse({ ...base, shop: { ...base.shop, offerTypes } }).success,
      true,
    );
  }
  assert.equal(
    schema.safeParse({
      ...base,
      shop: { ...base.shop, offerTypes: [], sports: [] },
    }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      ...base,
      shop: { ...base.shop, offerTypes: ["SPORTSWEAR"], categories: [] },
    }).success,
    false,
  );
});
test("Gear Up product supports optional price and governed taxonomy", () => {
  const schema = runtimeSchema("gearUpProductCreateSchema");
  const product = {
    title: "Club Jersey 2026",
    brand: "HOOMA Sports",
    description: "Official-style football jersey available from the local shop.",
    sports: ["FOOTBALL"],
    category: "JERSEYS_KITS",
    price: null,
    currency: "TND",
  };
  assert.equal(schema.safeParse(product).success, true);
  assert.equal(schema.safeParse({ ...product, price: 349 }).success, true);
  assert.equal(schema.safeParse({ ...product, sports: [] }).success, false);
  assert.equal(schema.safeParse({ ...product, price: -1 }).success, false);
});
test("Gear Up image limit is bounded from 1 through 10", () => {
  const schema = runtimeSchema("gearUpSettingsUpdateSchema");
  assert.equal(schema.safeParse({ productImageLimit: 1 }).success, true);
  assert.equal(schema.safeParse({ productImageLimit: 3 }).success, true);
  assert.equal(schema.safeParse({ productImageLimit: 10 }).success, true);
  assert.equal(schema.safeParse({ productImageLimit: 0 }).success, false);
  assert.equal(schema.safeParse({ productImageLimit: 11 }).success, false);
});
