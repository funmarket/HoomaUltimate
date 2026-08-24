import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  WhistleContextType,
  WhistleMetadataRecord,
  WhistleRepository,
} from "../application/whistle.repository.js";

type MetadataRow = {
  id: string;
  authorUserId: string;
  contextType: WhistleContextType;
  contextId: string;
  createdAt: Date;
  expiresAt: Date;
  displayName: string | null;
  username: string | null;
  photoUrl: string | null;
};

function rowToRecord(row: MetadataRow): WhistleMetadataRecord {
  return {
    id: row.id,
    authorUserId: row.authorUserId,
    contextType: row.contextType,
    contextId: row.contextId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    author: {
      presentation:
        row.displayName && row.username
          ? { displayName: row.displayName, username: row.username, photoUrl: row.photoUrl }
          : null,
    },
  };
}

function utcDayBounds(dayKey: string): { start: Date; end: Date } {
  const start = new Date(`${dayKey}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export class PrismaWhistleRepository implements WhistleRepository {
  constructor(private readonly db: PrismaClient) {}

  async createWithDailyQuota(input: {
    id: string;
    authorUserId: string;
    contextType: WhistleContextType;
    contextId: string;
    createdAt: Date;
    expiresAt: Date;
    dayKey: string;
    dailyLimit: number;
  }): Promise<WhistleMetadataRecord | null> {
    const { start, end } = utcDayBounds(input.dayKey);
    return this.db.$transaction(async (tx) => {
      const lockKey = `whistle-quota:${input.authorUserId}:${input.dayKey}`;
      await tx.$executeRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );
      const countRows = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`
        SELECT COUNT(*)::bigint AS count
        FROM "WhistleMetadata"
        WHERE "authorUserId" = ${input.authorUserId}
          AND "createdAt" >= ${start}
          AND "createdAt" < ${end}
      `);
      if (Number(countRows[0]?.count ?? 0n) >= input.dailyLimit) return null;
      const rows = await tx.$queryRaw<MetadataRow[]>(Prisma.sql`
        INSERT INTO "WhistleMetadata" ("id", "authorUserId", "contextType", "contextId", "createdAt", "expiresAt")
        VALUES (${input.id}, ${input.authorUserId}, CAST(${input.contextType} AS "WhistleContextType"), ${input.contextId}, ${input.createdAt}, ${input.expiresAt})
        RETURNING "id", "authorUserId", "contextType", "contextId", "createdAt", "expiresAt",
          NULL::text AS "displayName", NULL::text AS "username", NULL::text AS "photoUrl"
      `);
      const row = rows[0];
      return row ? rowToRecord(row) : null;
    });
  }

  async quotaUsed(userId: string, dayKey: string): Promise<number> {
    const { start, end } = utcDayBounds(dayKey);
    const rows = await this.db.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM "WhistleMetadata"
      WHERE "authorUserId" = ${userId}
        AND "createdAt" >= ${start}
        AND "createdAt" < ${end}
    `);
    return Number(rows[0]?.count ?? 0n);
  }

  async listActive(
    contextType: WhistleContextType,
    contextId: string,
    now: Date,
    limit: number,
  ): Promise<WhistleMetadataRecord[]> {
    const rows = await this.db.$queryRaw<MetadataRow[]>(Prisma.sql`
      SELECT w."id", w."authorUserId", w."contextType", w."contextId", w."createdAt", w."expiresAt",
        p."displayName", p."username", p."photoUrl"
      FROM "WhistleMetadata" w
      LEFT JOIN "UserPresentation" p ON p."userId" = w."authorUserId"
      WHERE w."contextType" = CAST(${contextType} AS "WhistleContextType")
        AND w."contextId" = ${contextId}
        AND w."expiresAt" > ${now}
      ORDER BY w."createdAt" DESC, w."id" DESC
      LIMIT ${limit}
    `);
    return rows.map(rowToRecord);
  }

  async deleteExpired(now: Date): Promise<number> {
    const result = await this.db.whistleMetadata.deleteMany({ where: { expiresAt: { lte: now } } });
    return result.count;
  }
}
