import type { AthletesCalendarRsvpStatus } from "@hooma/contracts/athletes";
import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  AthletesCalendarCreateRecordInput,
  AthletesCalendarEntryViewPageRecord,
  AthletesCalendarRecord,
  AthletesCalendarRepository,
  AthletesCalendarRsvpUpsertInput,
  AthletesCalendarTransactionRepository,
  AthletesCalendarUpdateRecordInput,
} from "../application/athletes-calendar.repository.js";
import type {
  AthletesCalendarTransactionScope,
  AthletesCalendarUnitOfWork,
} from "../application/athletes-calendar.unit-of-work.js";
import { PrismaAthletesRepository } from "./prisma-athletes.repository.js";

const calendarSelect = Prisma.validator<Prisma.AthletesCalendarEntrySelect>()({
  id: true,
  athletesCommunityId: true,
  title: true,
  description: true,
  location: true,
  startsAt: true,
  endsAt: true,
  timezone: true,
  cancelledAt: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
});

type CalendarRow = Prisma.AthletesCalendarEntryGetPayload<{ select: typeof calendarSelect }>;
type ActiveRsvpCountRow = {
  readonly calendarEntryId: string;
  readonly status: AthletesCalendarRsvpStatus;
  readonly count: bigint;
};

function mapRow(row: CalendarRow): AthletesCalendarRecord {
  return row;
}

class PrismaAthletesCalendarTransactionRepository implements AthletesCalendarTransactionRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async create(input: AthletesCalendarCreateRecordInput): Promise<AthletesCalendarRecord> {
    return mapRow(
      await this.tx.athletesCalendarEntry.create({ data: input, select: calendarSelect }),
    );
  }

  async getForCommunity(
    athletesCommunityId: string,
    entryId: string,
  ): Promise<AthletesCalendarRecord | null> {
    const row = await this.tx.athletesCalendarEntry.findFirst({
      where: { id: entryId, athletesCommunityId },
      select: calendarSelect,
    });
    return row ? mapRow(row) : null;
  }

  async update(
    athletesCommunityId: string,
    entryId: string,
    input: AthletesCalendarUpdateRecordInput,
  ): Promise<AthletesCalendarRecord | null> {
    const result = await this.tx.athletesCalendarEntry.updateMany({
      where: { id: entryId, athletesCommunityId, cancelledAt: null },
      data: input,
    });
    if (result.count !== 1) return null;
    return this.getForCommunity(athletesCommunityId, entryId);
  }

  async cancel(
    athletesCommunityId: string,
    entryId: string,
    cancelledAt: Date,
  ): Promise<AthletesCalendarRecord | null> {
    await this.tx.athletesCalendarEntry.updateMany({
      where: { id: entryId, athletesCommunityId, cancelledAt: null },
      data: { cancelledAt },
    });
    return this.getForCommunity(athletesCommunityId, entryId);
  }

  async upsertRsvp(input: AthletesCalendarRsvpUpsertInput): Promise<void> {
    await this.tx.athletesCalendarRsvp.upsert({
      where: {
        calendarEntryId_userId: {
          calendarEntryId: input.calendarEntryId,
          userId: input.userId,
        },
      },
      update: { status: input.status },
      create: input,
      select: { id: true },
    });
  }
}

export class PrismaAthletesCalendarRepository
  implements AthletesCalendarRepository, AthletesCalendarUnitOfWork
{
  constructor(private readonly db: PrismaClient) {}

  async listForCommunity(
    athletesCommunityId: string,
    input: Parameters<AthletesCalendarRepository["listForCommunity"]>[1],
    viewerUserId: string,
  ): Promise<AthletesCalendarEntryViewPageRecord> {
    const rows = await this.db.athletesCalendarEntry.findMany({
      where: {
        athletesCommunityId,
        startsAt: { lt: input.range.to },
        endsAt: { gt: input.range.from },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: input.limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: calendarSelect,
    });
    const pageRows = rows.slice(0, input.limit);
    if (pageRows.length === 0) return { items: [], nextCursor: null };

    const entryIds = pageRows.map((row) => row.id);
    const [grouped, viewerRows] = await Promise.all([
      this.db.$queryRaw<ActiveRsvpCountRow[]>(Prisma.sql`
        SELECT
          r."calendarEntryId" AS "calendarEntryId",
          r."status" AS "status",
          COUNT(*)::bigint AS "count"
        FROM "AthletesCalendarRsvp" AS r
        INNER JOIN "AthletesMembership" AS m
          ON m."userId" = r."userId"
         AND m."athletesCommunityId" = ${athletesCommunityId}
         AND m."leftAt" IS NULL
        WHERE r."calendarEntryId" IN (${Prisma.join(entryIds)})
        GROUP BY r."calendarEntryId", r."status"
      `),
      this.db.athletesCalendarRsvp.findMany({
        where: { calendarEntryId: { in: entryIds }, userId: viewerUserId },
        select: { calendarEntryId: true, status: true },
      }),
    ]);

    const countsByEntry = new Map(entryIds.map((id) => [id, { going: 0, maybe: 0, notGoing: 0 }]));
    for (const group of grouped) {
      const counts = countsByEntry.get(group.calendarEntryId);
      if (!counts) continue;
      const count = Number(group.count);
      if (group.status === "GOING") counts.going = count;
      if (group.status === "MAYBE") counts.maybe = count;
      if (group.status === "NOT_GOING") counts.notGoing = count;
    }

    const viewerByEntry = new Map(viewerRows.map((row) => [row.calendarEntryId, row.status]));
    return {
      items: pageRows.map((row) => ({
        entry: mapRow(row),
        viewerStatus: viewerByEntry.get(row.id) ?? null,
        counts: countsByEntry.get(row.id) ?? { going: 0, maybe: 0, notGoing: 0 },
      })),
      nextCursor: rows.length > input.limit ? (pageRows.at(-1)?.id ?? null) : null,
    };
  }

  withCommunityLock<T>(
    athletesCommunityId: string,
    operation: (scope: AthletesCalendarTransactionScope) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(async (tx) => {
      const athletes = new PrismaAthletesRepository(tx);
      return athletes.withCommunityLock(athletesCommunityId, (lockedAthletes) =>
        operation({
          athletes: lockedAthletes,
          calendar: new PrismaAthletesCalendarTransactionRepository(tx),
        }),
      );
    });
  }

  withCommunitySharedLock<T>(
    athletesCommunityId: string,
    operation: (scope: AthletesCalendarTransactionScope) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "AthletesCommunity" WHERE "id" = ${athletesCommunityId} FOR SHARE`;
      return operation({
        athletes: new PrismaAthletesRepository(tx),
        calendar: new PrismaAthletesCalendarTransactionRepository(tx),
      });
    });
  }
}
