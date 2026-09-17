import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaRequestRepository } from "../apps/api/src/modules/requests/infrastructure/prisma-request.repository.js";

const db = getDatabaseClient();

test("Requests enforce one response per responder and one terminal response decision", async () => {
  const repository = new PrismaRequestRepository(db);
  const owner = await db.user.create({ data: {} });
  const helper = await db.user.create({ data: {} });

  try {
    const request = await repository.create(owner.id, {
      publisher: {},
      audience: { scope: "PUBLIC" },
      category: "SERVICE",
      title: "Need help moving equipment",
      description: "Need one person to help move equipment this weekend.",
    });

    const [first, second] = await Promise.all([
      repository.createResponse(request.id, helper.id, "I can help Saturday."),
      repository.createResponse(request.id, helper.id, "I can also help Sunday."),
    ]);

    assert.equal([first, second].filter(Boolean).length, 1);
    const response = first ?? second;
    assert.ok(response);

    const [accepted, declined] = await Promise.all([
      repository.acceptResponse(request.id, response.id),
      repository.declineResponse(request.id, response.id),
    ]);

    assert.equal([accepted, declined].filter(Boolean).length, 1);
    assert.ok(["ACCEPTED", "DECLINED"].includes((accepted ?? declined)?.status ?? ""));
  } finally {
    await db.user.deleteMany({ where: { id: { in: [owner.id, helper.id] } } });
    await db.$disconnect();
  }
});

test("Requests lifecycle transition is compare-and-set safe under concurrency", async () => {
  const repository = new PrismaRequestRepository(db);
  const owner = await db.user.create({ data: {} });

  try {
    const request = await repository.create(owner.id, {
      publisher: {},
      audience: { scope: "PUBLIC" },
      category: "SERVICE",
      title: "Need help moving equipment",
      description: "Need one person to help move equipment this weekend.",
    });

    const [fulfilled, cancelled] = await Promise.all([
      repository.transitionRequestStatus(request.id, ["OPEN"], "FULFILLED"),
      repository.transitionRequestStatus(request.id, ["OPEN"], "CANCELLED"),
    ]);

    assert.equal([fulfilled, cancelled].filter(Boolean).length, 1);
  } finally {
    await db.user.delete({ where: { id: owner.id } });
    await db.$disconnect();
  }
});
