import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRideOfferCompensationTerms,
  buildRideRequestCompensationTerms,
} from "../packages/frontend/src/rides/RideCompensationFields.tsx";

test("Ride compensation builders emit exact offer discriminated union variants", () => {
  assert.deepEqual(
    buildRideOfferCompensationTerms({
      type: "FREE",
      amount: "10.500",
      currency: "TND",
      basis: "TOTAL",
    }),
    { type: "FREE" },
  );
  assert.deepEqual(
    buildRideOfferCompensationTerms({
      type: "CASH",
      amount: "10.500",
      currency: "TND",
      basis: "PER_SEAT",
    }),
    { type: "CASH", amountMinor: 10500, currency: "TND", basis: "PER_SEAT" },
  );
  assert.deepEqual(
    buildRideOfferCompensationTerms({
      type: "CASH",
      amount: "25",
      currency: "TND",
      basis: "TOTAL",
    }),
    { type: "CASH", amountMinor: 25000, currency: "TND", basis: "TOTAL" },
  );
});

test("Ride compensation builders emit exact request variants without basis", () => {
  assert.deepEqual(
    buildRideRequestCompensationTerms({
      type: "FREE",
      amount: "8",
      currency: "TND",
      basis: "PER_SEAT",
    }),
    { type: "FREE" },
  );
  assert.deepEqual(
    buildRideRequestCompensationTerms({
      type: "CASH",
      amount: "8",
      currency: "TND",
      basis: "TOTAL",
    }),
    { type: "CASH", amountMinor: 8000, currency: "TND" },
  );
});

test("Ride compensation builders reject invalid cash amounts before API submit", () => {
  assert.throws(
    () =>
      buildRideOfferCompensationTerms({
        type: "CASH",
        amount: "0",
        currency: "TND",
        basis: "PER_SEAT",
      }),
    /positive/,
  );
  assert.throws(
    () =>
      buildRideRequestCompensationTerms({
        type: "CASH",
        amount: "abc",
        currency: "TND",
        basis: "PER_SEAT",
      }),
    /valid amount/,
  );
});
