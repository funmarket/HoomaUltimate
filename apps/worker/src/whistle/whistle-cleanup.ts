import { Prisma, type PrismaClient } from "@hooma/database";

const DEFAULT_BATCH_SIZE = 500;

export type WhistleCleanupDatabase = Pick<PrismaClient, "$executeRaw">;

export interface WhistleCleanupResult {
  readonly deletedMetadata: number;
}

export async function cleanupExpiredWhistles(
  database: WhistleCleanupDatabase,
  now: Date = new Date(),
  batchSize = DEFAULT_BATCH_SIZE,
): Promise<WhistleCleanupResult> {
  const boundedBatchSize = Math.max(1, Math.min(1_000, Math.trunc(batchSize)));
  const deleted = await database.$executeRaw(Prisma.sql`
    WITH expired AS (
      SELECT "id"
      FROM "WhistleMetadata"
      WHERE "expiresAt" <= ${now}
      ORDER BY "expiresAt" ASC, "id" ASC
      LIMIT ${boundedBatchSize}
    )
    DELETE FROM "WhistleMetadata" w
    USING expired
    WHERE w."id" = expired."id"
  `);

  return { deletedMetadata: Number(deleted) };
}
