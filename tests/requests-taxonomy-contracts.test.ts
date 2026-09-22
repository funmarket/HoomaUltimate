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
  requestType: "SPORT" as const,
  sport: "FOOTBALL" as const,
  subcategoryId: "hts-football-equipment",
  needId: "htn-football-ball",
  title: "Need a football",
  description: "Looking for a football for a local training session.",
  quantityNeeded: 1,
};

const communityInput = {
  publisher: {},
  audience: { scope: "PUBLIC" as const },
  requestType: "COMMUNITY" as const,
  subcategoryId: "hts-community-lost-found",
  needId: "htn-community-lost-item",
  title: "Lost my wallet near the stadium",
  description: "Lost a brown wallet after the match; asking the local community.",
};

test("Request contracts accept corrected sport-first creation without legacy category fields", () => {
  const parsed = helpRequestCreateSchema.parse(correctedInput);
  assert.equal(parsed.requestType, "SPORT");
  assert.equal(parsed.sport, "FOOTBALL");
  assert.equal(parsed.subcategoryId, "hts-football-equipment");
  assert.equal(parsed.needId, "htn-football-ball");
  assert.equal(parsed.category, undefined);
});

test("Request contracts require a sport for a sport request", () => {
  assert.throws(() => helpRequestCreateSchema.parse({ ...correctedInput, sport: undefined }));
});

test("Request contracts accept a community request with no sport", () => {
  const parsed = helpRequestCreateSchema.parse(communityInput);
  assert.equal(parsed.requestType, "COMMUNITY");
  assert.equal(parsed.sport, undefined);
  assert.equal(parsed.subcategoryId, "hts-community-lost-found");
});

test("Request contracts reject a community request that selects a sport", () => {
  assert.throws(() => helpRequestCreateSchema.parse({ ...communityInput, sport: "FOOTBALL" }));
});

test("Request contracts require a request type together with a taxonomy selection", () => {
  assert.throws(() => helpRequestCreateSchema.parse({ ...correctedInput, requestType: undefined }));
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
  assert.throws(() =>
    helpRequestCreateSchema.parse({ ...correctedInput, subcategoryId: undefined }),
  );
  assert.throws(() =>
    helpRequestCreateSchema.parse({
      publisher: {},
      audience: { scope: "PUBLIC" },
      title: "Missing taxonomy",
      description: "This corrected request has no taxonomy or legacy category.",
    }),
  );
});

test("Request contracts accept only http and https image URLs", () => {
  const withImage = (imageUrl: string) =>
    helpRequestCreateSchema.parse({ ...correctedInput, imageUrl });

  assert.equal(
    withImage("https://cdn.example.com/ball.png").imageUrl,
    "https://cdn.example.com/ball.png",
  );
  assert.equal(
    withImage("http://cdn.example.com/ball.png").imageUrl,
    "http://cdn.example.com/ball.png",
  );
  assert.throws(() => withImage("javascript:alert(1)"));
  assert.throws(() => withImage("data:image/png;base64,AAAA"));
  assert.throws(() => withImage("file:///c:/secret.png"));
  assert.throws(() => helpRequestCreateSchema.parse({ ...correctedInput, imageUrl: "not a url" }));
});

test("Request contracts keep the full address and custom need optional", () => {
  const bare = helpRequestCreateSchema.parse(correctedInput);
  assert.equal(bare.fullAddress, undefined);
  assert.equal(bare.customNeed, undefined);

  const addressed = helpRequestCreateSchema.parse({
    ...correctedInput,
    fullAddress: "12 Rue de la Plage, La Marsa",
    customNeed: "Left-footed defensive training partner",
  });
  assert.equal(addressed.fullAddress, "12 Rue de la Plage, La Marsa");
  assert.equal(addressed.customNeed, "Left-footed defensive training partner");
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
    requester: {
      userId: "user-1",
      username: "sami",
      displayName: "Sami B",
      photoUrl: null,
    },
    publisherCommunityId: null,
    publisherTeamId: null,
    publisherAthletesCommunityId: null,
    audienceScope: "PUBLIC",
    audienceCommunityId: null,
    audienceAthletesCommunityId: null,
    requestType: "SPORT",
    category: "ITEM",
    itemKind: null,
    sport: "FOOTBALL",
    subcategoryId: "hts-football-equipment",
    needId: "htn-football-ball",
    customNeed: null,
    taxonomy: {
      requestType: "SPORT",
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
    fullAddress: null,
    locationNote: null,
    imageUrl: null,
    hasUploadedImage: false,
    neededByAt: null,
    expiresAt: null,
    status: "OPEN",
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  });
  assert.equal(parsed.taxonomy?.need.label, "Football");
  assert.equal(parsed.requester?.username, "sami");
  assert.equal(parsed.category, "ITEM");
});

test("Request read DTO allows a community Request without a sport and without a requester projection", () => {
  const parsed = helpRequestSchema.parse({
    id: "request-2",
    createdByUserId: "user-2",
    requester: null,
    publisherCommunityId: null,
    publisherTeamId: null,
    publisherAthletesCommunityId: null,
    audienceScope: "PUBLIC",
    audienceCommunityId: null,
    audienceAthletesCommunityId: null,
    requestType: "COMMUNITY",
    category: "COMMUNITY",
    itemKind: null,
    sport: null,
    subcategoryId: "hts-community-lost-found",
    needId: "htn-community-other",
    customNeed: "Lost my wallet",
    taxonomy: {
      requestType: "COMMUNITY",
      sport: null,
      sportLabel: null,
      subcategory: { id: "hts-community-lost-found", slug: "lost-found", label: "Lost & Found" },
      need: {
        id: "htn-community-other",
        slug: "other",
        label: "Other",
        kind: "COMMUNITY_SUPPORT",
        allowsCustomText: true,
      },
    },
    title: "Lost my wallet near the stadium",
    description: "Lost a brown wallet after the match; asking the local community.",
    quantityNeeded: null,
    sizeLabel: null,
    conditionPreference: null,
    placeId: null,
    city: "Tunis",
    houma: "La Marsa",
    fullAddress: null,
    locationNote: null,
    imageUrl: null,
    hasUploadedImage: true,
    neededByAt: null,
    expiresAt: null,
    status: "OPEN",
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
  });
  assert.equal(parsed.taxonomy?.requestType, "COMMUNITY");
  assert.equal(parsed.sport, null);
  assert.equal(parsed.customNeed, "Lost my wallet");
  assert.equal(parsed.hasUploadedImage, true);
});
