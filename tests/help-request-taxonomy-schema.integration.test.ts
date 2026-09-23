import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";

const db = getDatabaseClient();

function requestData(userId: string) {
  return {
    createdByUserId: userId,
    audienceScope: "PUBLIC" as const,
    category: "ITEM" as const,
    title: "Need football equipment",
    description: "Looking for football equipment for a local training session.",
  };
}

test("HelpRequest taxonomy constraints preserve legacy rows and reject mismatched hierarchy", async () => {
  const user = await db.user.create({ data: {} });
  try {
    const legacy = await db.helpRequest.create({
      data: {
        ...requestData(user.id),
        category: "OTHER",
        sport: null,
        subcategoryId: null,
        needId: null,
      },
    });
    assert.equal(legacy.subcategoryId, null);
    assert.equal(legacy.needId, null);

    const valid = await db.helpRequest.create({
      data: {
        ...requestData(user.id),
        requestType: "SPORT",
        sport: "FOOTBALL",
        subcategoryId: "hts-football-equipment",
        needId: "htn-football-ball",
      },
    });
    assert.equal(valid.subcategoryId, "hts-football-equipment");
    assert.equal(valid.needId, "htn-football-ball");

    await assert.rejects(
      db.helpRequest.create({
        data: {
          ...requestData(user.id),
          requestType: "SPORT",
          sport: "RUNNING",
          subcategoryId: "hts-football-equipment",
          needId: "htn-football-ball",
        },
      }),
    );

    await assert.rejects(
      db.helpRequest.create({
        data: {
          ...requestData(user.id),
          requestType: "SPORT",
          sport: "FOOTBALL",
          subcategoryId: "hts-football-footwear",
          needId: "htn-football-ball",
        },
      }),
    );
  } finally {
    await db.helpRequest.deleteMany({ where: { createdByUserId: user.id } });
    await db.user.delete({ where: { id: user.id } });
    await db.$disconnect();
  }
});
