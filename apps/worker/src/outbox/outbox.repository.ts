import { Prisma, type PrismaClient } from "@hooma/database";

export interface ClaimedOutboxEvent {
  readonly id: string;
  readonly topic: string;
  readonly payload: Prisma.JsonValue;
  readonly attempts: number;
  readonly claimedAt: Date;
}

interface OutboxRow {
  readonly id: string;
  readonly topic: string;
  readonly payload: Prisma.JsonValue;
  readonly attempts: number;
}

export class OutboxRepository {
  constructor(private readonly db: PrismaClient) {}

  async claimAvailable(input: {
    readonly topics: readonly string[];
    readonly now: Date;
    readonly staleBefore: Date;
    readonly limit: number;
  }): Promise<ClaimedOutboxEvent[]> {
    if (input.topics.length === 0 || input.limit <= 0) return [];

    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<OutboxRow[]>(Prisma.sql`
        SELECT "id", "topic", "payload", "attempts"
        FROM "OutboxEvent"
        WHERE "topic" IN (${Prisma.join(input.topics)})
          AND (
            ("status" = 'PENDING' AND "availableAt" <= ${input.now})
            OR (
              "status" = 'PROCESSING'
              AND "claimedAt" IS NOT NULL
              AND "claimedAt" <= ${input.staleBefore}
            )
          )
        ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${input.limit}
      `);

      if (rows.length === 0) return [];

      const ids = rows.map((row) => row.id);
      await tx.outboxEvent.updateMany({
        where: { id: { in: ids } },
        data: {
          status: "PROCESSING",
          claimedAt: input.now,
          lastError: null,
        },
      });

      return rows.map((row) => ({ ...row, claimedAt: input.now }));
    });
  }

  async markDelivered(event: ClaimedOutboxEvent, deliveredAt: Date): Promise<boolean> {
    const result = await this.db.outboxEvent.updateMany({
      where: {
        id: event.id,
        status: "PROCESSING",
        claimedAt: event.claimedAt,
      },
      data: {
        status: "DELIVERED",
        deliveredAt,
        claimedAt: null,
        lastError: null,
      },
    });
    return result.count === 1;
  }

  async markFailed(input: {
    readonly event: ClaimedOutboxEvent;
    readonly attempts: number;
    readonly retryAt: Date;
    readonly terminal: boolean;
    readonly error: string;
  }): Promise<boolean> {
    const result = await this.db.outboxEvent.updateMany({
      where: {
        id: input.event.id,
        status: "PROCESSING",
        claimedAt: input.event.claimedAt,
      },
      data: {
        status: input.terminal ? "FAILED" : "PENDING",
        attempts: input.attempts,
        availableAt: input.retryAt,
        claimedAt: null,
        lastError: input.error,
      },
    });
    return result.count === 1;
  }
}
