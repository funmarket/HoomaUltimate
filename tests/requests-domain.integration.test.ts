import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaRequestRepository } from "../apps/api/src/modules/requests/infrastructure/prisma-request.repository.js";

const db = getDatabaseClient();

test("Requests persist publicly and enforce database quantity integrity", async () => {
  const repository = new PrismaRequestRepository(db);
  const creator = await db.user.create({ data: {} });
  const viewer = await db.user.create({ data: {} });

  try {
    const created = await repository.create(creator.id, {
      publisher: {},
      audience: { scope: "PUBLIC" },
      category: "ITEM",
      itemKind: "FOOTWEAR",
      title: "Need running shoes",
      description: "Looking for size 43 running shoes for training.",
      quantityNeeded: 1,
    });

    assert.equal((await repository.getPublic(created.id))?.id, created.id);
    assert.equal((await repository.getVisibleToMember(viewer.id, created.id))?.id, created.id);

    await assert.rejects(
      db.helpRequest.create({
        data: {
          createdByUserId: creator.id,
          audienceScope: "PUBLIC",
          category: "ITEM",
          title: "Invalid quantity",
          description: "This row must be rejected by the database constraint.",
          quantityNeeded: 0,
        },
      }),
    );
  } finally {
    await db.user.deleteMany({ where: { id: { in: [creator.id, viewer.id] } } });
    await db.$disconnect();
  }
});
