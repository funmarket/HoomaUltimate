import type { Prisma, PrismaClient } from "@hooma/database";
import type {
  AuditEntryExistsQuery,
  AuditPageQuery,
  AuditReader,
} from "../application/audit-reader.js";

export class PrismaAuditReader implements AuditReader {
  constructor(private readonly db: PrismaClient) {}

  async count(transaction?: Prisma.TransactionClient): Promise<number> {
    return (transaction ?? this.db).auditLog.count();
  }

  async findPage(query: AuditPageQuery) {
    const createdAtFilter = {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    };
    const rows = await this.db.auditLog.findMany({
      select: {
        id: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
      where: {
        ...(query.actorUserId ? { actorUserId: { contains: query.actorUserId } } : {}),
        ...(query.action ? { action: query.action } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(Object.keys(createdAtFilter).length ? { createdAt: createdAtFilter } : {}),
        ...(query.cursor
          ? {
              OR: [
                { createdAt: { lt: query.cursor.createdAt } },
                { createdAt: query.cursor.createdAt, id: { lt: query.cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit).map((row) => ({
      id: row.id,
      actorUserId: row.actorUserId,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      createdAt: row.createdAt,
    }));
    const extra = rows.length > query.limit ? items.at(-1) : undefined;
    return {
      items,
      nextCursor: extra ? { createdAt: extra.createdAt, id: extra.id } : null,
    };
  }

  async exists(query: AuditEntryExistsQuery): Promise<boolean> {
    const entry = await this.db.auditLog.findFirst({
      where: {
        action: { in: [...query.actions] },
        entityType: query.entityType,
        entityId: query.entityId,
        ...(query.createdAtGte ? { createdAt: { gte: query.createdAtGte } } : {}),
      },
      select: { id: true },
    });
    return Boolean(entry);
  }
}
