import assert from "node:assert/strict";
import test from "node:test";
import {
  athletesCommunityCreateSchema,
  athletesPublicDetailSchema,
  athletesPublicSummarySchema,
  athletesMemberAddSchema,
  athletesRoleSchema,
  athletesSportSchema,
  athletesJoinRequestStatusSchema,
} from "@hooma/contracts/athletes";

test("Athletes contracts accept a bounded valid create payload", () => {
  const parsed = athletesCommunityCreateSchema.parse({
    name: "Carthage Runners",
    sport: "RUNNING",
    description: "Morning runs and race prep.",
    city: "Tunis",
    houma: "Carthage",
    logoUrl: "https://images.example.com/logo.png",
    bannerUrl: "https://images.example.com/banner.png",
    visibility: "PUBLIC",
    joinPolicy: "APPROVAL_REQUIRED",
  });
  assert.equal(parsed.name, "Carthage Runners");
  assert.equal(parsed.sport, "RUNNING");
});

test("Athletes contracts reject invalid sport, role, status and generic fields", () => {
  assert.throws(() => athletesSportSchema.parse("ULTRAS"));
  assert.throws(() => athletesRoleSchema.parse("COACH"));
  assert.throws(() => athletesJoinRequestStatusSchema.parse("ACCEPTED"));
  assert.throws(() =>
    athletesCommunityCreateSchema.parse({
      name: "Generic",
      sport: "CYCLING",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      communityId: "community-1",
    }),
  );
});

test("Athletes direct add uses username input only", () => {
  assert.deepEqual(athletesMemberAddSchema.parse({ username: "runner_one" }), {
    username: "runner_one",
  });
  assert.throws(() => athletesMemberAddSchema.parse({ userId: "user-1" }));
});

test("public Athletes projections do not expose creator user ids", () => {
  assert.equal("createdByUserId" in athletesPublicSummarySchema.shape, false);
  assert.equal("createdByUserId" in athletesPublicDetailSchema.shape, false);
});
