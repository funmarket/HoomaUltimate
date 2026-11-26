import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaAthletesRepository } from "../apps/api/src/modules/athletes/infrastructure/prisma-athletes.repository.js";

const db = getDatabaseClient();

test("Athletes identity supports independent managed logo and banner without losing legacy URLs", async () => {
  const user = await db.user.create({ data: {} });
  const repository = new PrismaAthletesRepository(db);
  try {
    const community = await repository.createWithFounder(user.id, {
      name: `Identity ${randomUUID()}`,
      sport: "RUNNING",
      visibility: "PUBLIC",
      joinPolicy: "OPEN",
      logoUrl: "https://example.org/logo.png",
      bannerUrl: "https://example.org/banner.png",
    });
    const rows = await db.$queryRaw<
      Array<{ logoMediaId: string | null; bannerMediaId: string | null }>
    >`
      SELECT "logoMediaId", "bannerMediaId" FROM "AthletesCommunity" WHERE "id" = ${community.id}
    `;
    assert.deepEqual(rows, [{ logoMediaId: null, bannerMediaId: null }]);
    const detail = await repository.getPublic(community.id);
    assert.equal(detail?.logoUrl, "https://example.org/logo.png");
    assert.equal(detail?.bannerUrl, "https://example.org/banner.png");
  } finally {
    await db.athletesCommunity.deleteMany({ where: { createdByUserId: user.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
