import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Team responsibility integration tests");
}

const db = getDatabaseClient();

test("database permits responsibility history but only one active identical assignment", async () => {
  const marker = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const user = await db.user.create({ data: {} });
  const team = await db.team.create({
    data: {
      slug: `responsibility-${marker}`,
      name: "Responsibility Concurrency Test",
      createdByUserId: user.id,
    },
  });

  try {
    const attempts = await Promise.allSettled([
      db.teamResponsibilityAssignment.create({
        data: { teamId: team.id, userId: user.id, role: "ASSISTANT" },
      }),
      db.teamResponsibilityAssignment.create({
        data: { teamId: team.id, userId: user.id, role: "ASSISTANT" },
      }),
    ]);

    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
    assert.equal(
      await db.teamResponsibilityAssignment.count({
        where: { teamId: team.id, userId: user.id, role: "ASSISTANT", revokedAt: null },
      }),
      1,
    );

    await db.teamResponsibilityAssignment.updateMany({
      where: { teamId: team.id, userId: user.id, role: "ASSISTANT", revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await db.teamResponsibilityAssignment.create({
      data: { teamId: team.id, userId: user.id, role: "ASSISTANT" },
    });

    assert.equal(
      await db.teamResponsibilityAssignment.count({
        where: { teamId: team.id, userId: user.id, role: "ASSISTANT" },
      }),
      2,
    );
    assert.equal(
      await db.teamResponsibilityAssignment.count({
        where: { teamId: team.id, userId: user.id, role: "ASSISTANT", revokedAt: null },
      }),
      1,
    );
  } finally {
    await db.team.delete({ where: { id: team.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
