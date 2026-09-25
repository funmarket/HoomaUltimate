import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  GEAR_UP_PAYMENT_METHODS,
  gearUpPaymentMethodSchema,
  gearUpShopSuggestionSchema,
  gearUpShopUpdateSchema,
} from "@hooma/contracts/gear-up";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function place(submissionOrigin: "OWNER" | "FANHUB") {
  return {
    name: "Elite Football Store",
    address: "10 Gear Street",
    city: "Tunis",
    submissionOrigin,
  };
}

function shop(paymentMethods?: readonly ("CASH" | "CRYPTO" | "CARD_BY_PHONE")[]) {
  return {
    offerTypes: ["SPORTSWEAR", "GEAR"] as const,
    sports: ["FOOTBALL"] as const,
    categories: ["JERSEYS_KITS", "BALLS"] as const,
    ...(paymentMethods ? { paymentMethods } : {}),
  };
}

test("Gear Up payment methods are closed to the three product-owner choices", () => {
  assert.deepEqual(GEAR_UP_PAYMENT_METHODS, ["CASH", "CRYPTO", "CARD_BY_PHONE"]);
  assert.equal(gearUpPaymentMethodSchema.parse("CASH"), "CASH");
  assert.equal(gearUpPaymentMethodSchema.parse("CRYPTO"), "CRYPTO");
  assert.equal(gearUpPaymentMethodSchema.parse("CARD_BY_PHONE"), "CARD_BY_PHONE");
  assert.throws(() => gearUpPaymentMethodSchema.parse("CARD_ONLINE"));
});

test("OWNER Gear Up submissions must declare at least one accepted payment method", () => {
  assert.throws(() =>
    gearUpShopSuggestionSchema.parse({
      place: place("OWNER"),
      shop: shop([]),
    }),
  );

  const parsed = gearUpShopSuggestionSchema.parse({
    place: place("OWNER"),
    shop: shop(["CASH", "CARD_BY_PHONE"]),
  });
  assert.deepEqual(parsed.shop.paymentMethods, ["CASH", "CARD_BY_PHONE"]);
});

test("FanHub Gear Up submissions may leave accepted payment methods unknown", () => {
  const parsed = gearUpShopSuggestionSchema.parse({
    place: place("FANHUB"),
    shop: shop(),
  });
  assert.deepEqual(parsed.shop.paymentMethods, []);
});

test("managed Gear Up shop updates can set one or more accepted payment methods", () => {
  assert.deepEqual(gearUpShopUpdateSchema.parse({ paymentMethods: ["CRYPTO"] }), {
    paymentMethods: ["CRYPTO"],
  });
  assert.throws(() => gearUpShopUpdateSchema.parse({ paymentMethods: [] }));
});

test("Gear Up exposes shared presentation DTOs and repository boundaries are not unknown", () => {
  const contracts = source("packages/contracts/src/gear-up.ts");
  for (const name of [
    "PublicGearUpShop",
    "ManagedGearUpShop",
    "GearUpReviewQueueItem",
    "GearUpProduct",
  ]) {
    assert.match(contracts, new RegExp(`export interface ${name}\\b`));
  }

  const repository = source("apps/api/src/modules/gear-up/application/gear-up.repository.ts");
  assert.doesNotMatch(repository, /Promise<readonly unknown\[\]>/);
  assert.doesNotMatch(repository, /Promise<unknown(?:\s*\|\s*null)?>/);
});
