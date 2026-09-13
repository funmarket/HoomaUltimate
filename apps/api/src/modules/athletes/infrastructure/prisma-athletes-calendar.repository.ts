import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  AthletesCalendarCreateRecordInput,
  AthletesCalendarRecord,
  AthletesCalendarRepository,
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
}

export class PrismaAthletesCalendarRepository
  implements AthletesCalendarRepository, AthletesCalendarUnitOfWork
{
  constructor(private readonly db: PrismaClient) {}

  async listForCommunity(
    athletesCommunityId: string,
    range: { readonly from: Date; readonly to: Date },
  ): Promise<AthletesCalendarRecord[]> {
    const rows = await this.db.athletesCalendarEntry.findMany({
      where: {
        athletesCommunityId,
        startsAt: { lt: range.to },
        endsAt: { gt: range.from },
      },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      select: calendarSelect,
    });
    return rows.map(mapRow);
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
}
