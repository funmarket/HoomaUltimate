import assert from "node:assert/strict";
import test from "node:test";
import { meResponseSchema } from "@hooma/contracts";
import {
  HELP_AUDIENCE_SCOPES,
  HELP_CATEGORIES,
  HELP_ITEM_KINDS,
  helpAudienceScopeSchema,
  helpCategorySchema,
  helpItemKindSchema,
} from "@hooma/contracts/help";

const baseMe = {
  id: "user-1",
  presentation: {
    username: "runner",
    displayName: "Runner",
    photoUrl: null,
    bio: null,
  },
  transports: ["web"] as const,
  platformRoles: [] as const,
  managerCapabilities: [] as const,
  communities: [],
  teams: [],
};

test("Help shared contracts expose the exact audience scopes", () => {
  assert.deepEqual(HELP_AUDIENCE_SCOPES, [
    "PUBLIC",
    "HOOMA_COMMUNITY",
    "ATHLETES_COMMUNITY",
  ]);
  for (const scope of HELP_AUDIENCE_SCOPES)
    assert.equal(helpAudienceScopeSchema.parse(scope), scope);
  assert.throws(() => helpAudienceScopeSchema.parse("TEAM"));
});

test("Help shared contracts expose the exact broad categories", () => {
  assert.deepEqual(HELP_CATEGORIES, [
    "PEOPLE",
    "ITEM",
    "PLACE",
    "TRANSPORT",
    "SERVICE",
    "EDUCATION",
    "COMMUNITY",
    "OTHER",
  ]);
  for (const category of HELP_CATEGORIES)
    assert.equal(helpCategorySchema.parse(category), category);
  assert.throws(() => helpCategorySchema.parse("FOOTBALL_REQUEST"));
});

test("Help shared contracts expose the shared item taxonomy", () => {
  assert.deepEqual(HELP_ITEM_KINDS, [
    "FOOTWEAR",
    "CLOTHING",
    "SPORTS_GEAR",
    "BOOKS",
    "EQUIPMENT",
    "SCHOOL_SUPPLIES",
    "HOUSEHOLD",
    "BIKE",
    "OTHER",
  ]);
  for (const kind of HELP_ITEM_KINDS) assert.equal(helpItemKindSchema.parse(kind), kind);
  assert.throws(() => helpItemKindSchema.parse("SALE_ITEM"));
});

test("me response includes Athletes communities as publisher contexts", () => {
  const parsed = meResponseSchema.parse({
    ...baseMe,
    athletesCommunities: [
      {
        id: "ath-1",
        name: "Tunis Runners",
        slug: "tunis-runners",
        role: "MODERATOR",
      },
    ],
  });

  assert.deepEqual(parsed.athletesCommunities, [
    {
      id: "ath-1",
      name: "Tunis Runners",
      slug: "tunis-runners",
      role: "MODERATOR",
    },
  ]);
  assert.throws(() =>
    meResponseSchema.parse({
      ...baseMe,
      athletesCommunities: [
        { id: "ath-1", name: "Tunis Runners", slug: "tunis-runners", role: "COACH" },
      ],
    }),
  );
});
