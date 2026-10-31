import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient, Prisma } from "@hooma/database";
import { PrismaAuditWriter } from "../apps/api/src/modules/audit/infrastructure/prisma-audit-writer.js";

test("transactional Audit append writes only through the caller transaction", async () => {
  const records: unknown[] = [];
  const root = { auditLog: { create: async () => { throw new Error("root client used"); } } } as unknown as PrismaClient;
  const transaction = { auditLog: { create: async (value: unknown) => { records.push(value); return {}; } } } as unknown as Prisma.TransactionClient;
  await new PrismaAuditWriter(root).writeInTransaction({
    actorUserId: "actor", action: "ACTION", entityType: "Place", entityId: "place",
    requestId: "req", metadata: { reason: "verified" },
  }, transaction);
  assert.deepEqual(records, [{ data: { actorUserId: "actor", action: "ACTION", entityType: "Place", entityId: "place", requestId: "req", metadata: { reason: "verified" } } }]);
});

test("standalone Audit append retains nullable fields and omits absent metadata", async () => {
  const records: unknown[] = [];
  const root = { auditLog: { create: async (value: unknown) => { records.push(value); return {}; } } } as unknown as PrismaClient;
  await new PrismaAuditWriter(root).write({ action: "ACTION", entityType: "AdminIssue" });
  assert.deepEqual(records, [{ data: { actorUserId: null, action: "ACTION", entityType: "AdminIssue", entityId: null, requestId: null } }]);
});

test("transactional Audit append propagates write failures", async () => {
  const error = new Error("audit persistence failed");
  const root = { auditLog: { create: async () => { throw new Error("root client used"); } } } as unknown as PrismaClient;
  const transaction = { auditLog: { create: async () => { throw error; } } } as unknown as Prisma.TransactionClient;
  await assert.rejects(new PrismaAuditWriter(root).writeInTransaction({ action: "ACTION", entityType: "Place" }, transaction), (caught: unknown) => caught === error);
});
