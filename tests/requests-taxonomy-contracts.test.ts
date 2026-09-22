import assert from "node:assert/strict";
import test from "node:test";
import {
  helpRequestCreateSchema,
  helpRequestListQuerySchema,
  helpRequestSchema,
} from "@hooma/contracts/requests";

const correctedInput = {
  publisher: {},
  audience: { scope: "PUBLIC" as const },
  sport: "FOOTBALL" as const,
  subcategoryId: "hts-football-equipment",
  needId: "htn-football-ball",
  title: "Need a football",
  description: "Looking for a football for a local training session.",
  quantityNeeded: 1,
};

test("Request contracts accept corrected sport-first creation without legacy category fields", () => {
  const parsed = helpRequestCreateSchema.parse(correctedInput);
  assert.equal(parsed.sport, "FOOTBALL");
  assert.equal(parsed.subcategoryId, "hts-football-equipment");
  assert.equal(parsed.needId, "htn-football-ball");
  assert.equal(parsed.category, undefined);
});

test("Request contracts keep legacy create compatibility during the frontend transition", () => {
  const parsed = helpRequestCreateSchema.parse({
    publisher: {},
    audience: { scope: "PUBLIC" },
    category: "ITEM",
    itemKind: "FOOTWEAR",
    sport: "RUNNING",
    title: "Need running shoes",
    description: "Looking for running shoes for training this week.",
  });
  assert.equal(parsed.category, "ITEM");
  assert.equal(parsed.itemKind, "FOOTWEAR");
});

test("Request contracts require a complete taxonomy selection for corrected creation", () => {
  assert.throws(() => helpRequestCreateSchema.parse({ ...correctedInput, needId: undefined }));
  assert.throws(() => helpRequestCreateSchema.parse({ ...correctedInput, subcategoryId: undefined }));
  assert.throws(() =>
    helpRequestCreateSchema.parse({
      publisher: {},
      audience: { scope: "PUBLIC" },
      title: "Missing taxonomy",
      description: "This corrected request has no taxonomy or legacy category.",
    }),
  );
});

test("Request list contracts expose only Request projection surfaces and taxonomy filters", () => {
  const parsed = helpRequestListQuerySchema.parse({
    surface: "PLAY",
    sport: "FOOTBALL",
    subcategoryId: "hts-football-equipment",
    needId: "htn-football-ball",
  });
  assert.equal(parsed.surface, "PLAY");
  assert.equal(parsed.subcategoryId, "hts-football-equipment");
  assert.equal(parsed.needId, "htn-football-ball");
  assert.throws(() => helpRequestListQuerySchema.parse({ surface: "DONATIONS" }));
});

test("Request read DTO carries resolved taxonomy presentation while retaining legacy fields", () => {
  const parsed = helpRequestSchema.parse({
    id: "request-1",
    createdByUserId: "user-1",
    publisherCommunityId: null,
    publisherTeamId: null,
    publisherAthletesCommunityId: null,
    audienceScope: "PUBLIC",
    audienceCommunityId: null,
    audienceAthletesCommunityId: null,
    category: "ITEM",
    itemKind: null,
    sport: "FOOTBALL",
    subcategoryId: "hts-football-equipment",
    needId: "htn-football-ball",
    customNeed: null,
    taxonomy: {
      sport: "FOOTBALL",
      sportLabel: "Football",
      subcategory: {
        id: "hts-football-equipment",
        slug: "equipment-gear",
        label: "Equipment & Gear",
      },
      need: {
        id: "htn-football-ball",
        slug: "football",
        label: "Football",
        kind: "PRODUCT",
        allowsCustomText: false,
      },
    },
    title: "Need a football",
    description: "Looking for a football for a local training session.",
    quantityNeeded: 1,
    sizeLabel: null,
    conditionPreference: null,
    placeId: null,
    city: "Tunis",
    houma: null,
    locationNote: null,
    neededByAt: null,
    expiresAt: null,
    status: "OPEN",
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  });
  assert.equal(parsed.taxonomy?.need.label, "Football");
  assert.equal(parsed.category, "ITEM");
});
