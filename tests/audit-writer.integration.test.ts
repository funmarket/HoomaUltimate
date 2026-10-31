import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { PrismaAuditWriter } from "../apps/api/src/modules/audit/infrastructure/prisma-audit-writer.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Audit writer integration tests");
}

const db = getDatabaseClient();
const writer = new PrismaAuditWriter(db);

test("Audit writer participates in caller commits and rollbacks", async () => {
  const committedAction = `AUDIT_WRITER_COMMIT_${randomUUID()}`;
  const rolledBackAction = `AUDIT_WRITER_ROLLBACK_${randomUUID()}`;

  try {
    await db.$transaction(async (tx) => {
      await writer.writeInTransaction(
        { action: committedAction, entityType: "AuditWriterTest" },
        tx,
      );
    });
    assert.equal(await db.auditLog.count({ where: { action: committedAction } }), 1);

    await assert.rejects(
      db.$transaction(async (tx) => {
        await writer.writeInTransaction(
          { action: rolledBackAction, entityType: "AuditWriterTest" },
          tx,
        );
        throw new Error("intentional caller rollback");
      }),
      /intentional caller rollback/,
    );
    assert.equal(await db.auditLog.count({ where: { action: rolledBackAction } }), 0);
  } finally {
    await db.auditLog.deleteMany({
      where: { action: { in: [committedAction, rolledBackAction] } },
    });
  }
});
