import assert from "node:assert/strict";
import test from "node:test";
import * as Contracts from "@hooma/contracts";

type RuntimeSchema = {
  safeParse(input: unknown): { success: boolean };
};

function runtimeSchema(name: string): RuntimeSchema {
  const exports = Contracts as unknown as Record<string, unknown>;
  const value = exports[name];
  assert.ok(
    value && typeof value === "object" && "safeParse" in value,
    `${name} is exported`,
  );
  return value as RuntimeSchema;
}

test("Gear Up shop contract accepts Sportswear, Gear, or both with governed taxonomy", () => {
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

test("Gear Up product contract supports optional price and requires governed sport/category", () => {
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

test("Gear Up settings bound the App Admin product image limit to 1 through 10", () => {
  const schema = runtimeSchema("gearUpSettingsUpdateSchema");

  assert.equal(schema.safeParse({ productImageLimit: 1 }).success, true);
  assert.equal(schema.safeParse({ productImageLimit: 3 }).success, true);
  assert.equal(schema.safeParse({ productImageLimit: 10 }).success, true);
  assert.equal(schema.safeParse({ productImageLimit: 0 }).success, false);
  assert.equal(schema.safeParse({ productImageLimit: 11 }).success, false);
});
