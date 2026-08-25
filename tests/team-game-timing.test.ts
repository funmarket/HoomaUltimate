import assert from "node:assert/strict";
import test from "node:test";
import { teamChallengeCreateSchema } from "@hooma/contracts";

test("Team challenge timing requires an explicit valid end when one is proposed", () => {
  const base = {
    challengerTeamId: "team-a",
    challengedTeamId: "team-b",
    format: "FIVE_V_FIVE" as const,
  };

  assert.equal(
    teamChallengeCreateSchema.safeParse({
      ...base,
      proposedEndsAt: "2026-08-25T12:00:00.000Z",
    }).success,
    false,
  );

  assert.equal(
    teamChallengeCreateSchema.safeParse({
      ...base,
      proposedAt: "2026-08-25T12:00:00.000Z",
      proposedEndsAt: "2026-08-25T11:00:00.000Z",
    }).success,
    false,
  );

  assert.equal(
    teamChallengeCreateSchema.safeParse({
      ...base,
      proposedAt: "2026-08-25T11:00:00.000Z",
      proposedEndsAt: "2026-08-25T12:00:00.000Z",
    }).success,
    true,
  );
});
