import type { Prisma, PrismaClient } from "@hooma/database";
import type { AuditEntryInput, AuditWriter } from "../application/audit-writer.js";

export class PrismaAuditWriter implements AuditWriter {
  constructor(private readonly db: PrismaClient) {}

  async write(entry: AuditEntryInput): Promise<void> {
    await this.append(entry, this.db);
  }

  async writeInTransaction(entry: AuditEntryInput, transaction: Prisma.TransactionClient): Promise<void> {
    await this.append(entry, transaction);
  }

  private async append(entry: AuditEntryInput, client: PrismaClient | Prisma.TransactionClient): Promise<void> {
    await client.auditLog.create({
      data: {
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        requestId: entry.requestId ?? null,
        ...(entry.metadata !== undefined
          ? { metadata: entry.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
  }
}
