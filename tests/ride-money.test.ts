import assert from "node:assert/strict";
import test from "node:test";
import {
  amountToMinorUnits,
  minorUnitsToAmountLabel,
} from "../packages/frontend/src/rides/ride-money.ts";

test("Ride money conversion uses currency exponent without floating point rounding", () => {
  assert.equal(amountToMinorUnits("10", "TND"), 10000);
  assert.equal(amountToMinorUnits("10.5", "TND"), 10500);
  assert.equal(amountToMinorUnits("10.500", "TND"), 10500);
  assert.equal(amountToMinorUnits("8", "EUR"), 800);
  assert.equal(minorUnitsToAmountLabel(10500, "TND"), "10.5 TND");
  assert.equal(minorUnitsToAmountLabel(800, "EUR"), "8 EUR");
});

test("Ride money display requires governed cash currency", () => {
  assert.equal(minorUnitsToAmountLabel(1000, "TND"), "1 TND");
  assert.equal(minorUnitsToAmountLabel(1000, "EUR"), "10 EUR");
  assert.equal(minorUnitsToAmountLabel(1000, "USD"), "10 USD");
});

test("Ride money conversion rejects malformed or unsupported amounts", () => {
  assert.throws(() => amountToMinorUnits("0", "TND"), /positive/);
  assert.throws(() => amountToMinorUnits("-1", "TND"), /valid amount/);
  assert.throws(() => amountToMinorUnits("abc", "TND"), /valid amount/);
  assert.throws(() => amountToMinorUnits("1.2345", "TND"), /up to 3 decimal/);
  assert.throws(() => amountToMinorUnits("1.234", "EUR"), /up to 2 decimal/);
});
