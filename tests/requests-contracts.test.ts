import assert from "node:assert/strict";
import test from "node:test";
import {
  helpRequestCreateSchema,
  helpRequestStatusSchema,
  requestConditionPreferenceSchema,
} from "@hooma/contracts/requests";

const validInput = {
  publisher: {},
  audience: { scope: "PUBLIC" as const },
  category: "ITEM" as const,
  itemKind: "FOOTWEAR" as const,
  sport: "RUNNING" as const,
  title: "Need running shoes",
  description: "Looking for size 43 running shoes for training.",
  quantityNeeded: 1,
  sizeLabel: "43",
  conditionPreference: "USED_OK" as const,
  city: "Tunis",
  houma: "La Marsa",
  neededByAt: "2026-10-01T12:00:00.000Z",
  expiresAt: "2026-10-05T12:00:00.000Z",
};

test("Request contracts accept the planned broad request shape", () => {
  const parsed = helpRequestCreateSchema.parse(validInput);
  assert.equal(parsed.category, "ITEM");
  assert.equal(parsed.itemKind, "FOOTWEAR");
  assert.equal(parsed.audience.scope, "PUBLIC");
});

test("Request contracts enforce title, description, quantity, publisher, and audience invariants", () => {
  assert.throws(() => helpRequestCreateSchema.parse({ ...validInput, title: "x" }));
  assert.throws(() => helpRequestCreateSchema.parse({ ...validInput, description: "short" }));
  assert.throws(() => helpRequestCreateSchema.parse({ ...validInput, quantityNeeded: 0 }));
  assert.throws(() =>
    helpRequestCreateSchema.parse({
      ...validInput,
      publisher: { publisherCommunityId: "community-1", publisherTeamId: "team-1" },
    }),
  );
  assert.throws(() =>
    helpRequestCreateSchema.parse({
      ...validInput,
      audience: { scope: "HOOMA_COMMUNITY" },
    }),
  );
  assert.throws(() =>
    helpRequestCreateSchema.parse({
      ...validInput,
      audience: { scope: "PUBLIC", communityId: "community-1" },
    }),
  );
});

test("Request status and condition contracts expose only the planned values", () => {
  for (const status of ["OPEN", "IN_PROGRESS", "FULFILLED", "CANCELLED", "EXPIRED"] as const) {
    assert.equal(helpRequestStatusSchema.parse(status), status);
  }
  assert.throws(() => helpRequestStatusSchema.parse("REOPENED"));

  for (const condition of ["ANY", "NEW_ONLY", "USED_OK"] as const) {
    assert.equal(requestConditionPreferenceSchema.parse(condition), condition);
  }
  assert.throws(() => requestConditionPreferenceSchema.parse("FOR_SALE"));
});


test("Request create input rejects requester presentation because Identity projection is read-only", () => {
  assert.throws(() =>
    helpRequestCreateSchema.parse({
      ...validInput,
      requester: {
        displayName: "Amine",
        username: "amine",
        photoUrl: "https://cdn.example.test/amine.jpg",
      },
    }),
  );
});
