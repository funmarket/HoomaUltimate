import type { PrismaClient, Prisma } from "@hooma/database";
import type {
  AthletesCalendarEntry,
  AthletesCalendarEntryCreateInput,
  AthletesCalendarEntryUpdateInput,
} from "@hooma/contracts/athletes-calendar";
import type { AthletesCalendarRepository } from "../application/athletes-calendar.repository.js";
import type {
  AthletesCalendarTransactionRepository,
  AthletesCalendarTransactionScope,
  AthletesCalendarUnitOfWork,
} from "../application/athletes-calendar.unit-of-work.js";
import { AthletesError } from "../domain/athletes-error.js";
import { PrismaAthletesRepository } from "./prisma-athletes.repository.js";

type CalendarRow = {
  id: string;
  athletesCommunityId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date | null;
  timezone: string;
  locationName: string | null;
  status: "SCHEDULED" | "CANCELLED";
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toEntry(row: CalendarRow): AthletesCalendarEntry {
  return {
    id: row.id,
    athletesCommunityId: row.athletesCommunityId,
    title: row.title,
    description: row.description,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    timezone: row.timezone,
    locationName: row.locationName,
    status: row.status,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

class PrismaAthletesCalendarTransactionRepository implements AthletesCalendarTransactionRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async create(
    athletesCommunityId: string,
    createdByUserId: string,
    input: AthletesCalendarEntryCreateInput,
  ) {
    const row = await this.tx.athletesCalendarEntry.create({
      data: {
        athletesCommunityId,
        createdByUserId,
        title: input.title,
        description: input.description ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        timezone: input.timezone,
        locationName: input.locationName ?? null,
      },
    });
    return toEntry(row);
  }

  async update(
    athletesCommunityId: string,
    entryId: string,
    input: AthletesCalendarEntryUpdateInput,
  ) {
    const current = await this.tx.athletesCalendarEntry.findFirst({
      where: { id: entryId, athletesCommunityId },
    });
    if (!current) {
      throw new AthletesError("ATHLETES_CALENDAR_ENTRY_NOT_FOUND", "Calendar event not found");
    }
    if (current.status !== "SCHEDULED") {
      throw new AthletesError(
        "ATHLETES_CALENDAR_ENTRY_NOT_EDITABLE",
        "Cancelled calendar events cannot be edited",
      );
    }
    const row = await this.tx.athletesCalendarEntry.update({
      where: { id: entryId },
      data: {
        title: input.title,
        description: input.description ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        timezone: input.timezone,
        locationName: input.locationName ?? null,
      },
    });
    return toEntry(row);
  }

  async cancel(athletesCommunityId: string, entryId: string) {
    const current = await this.tx.athletesCalendarEntry.findFirst({
      where: { id: entryId, athletesCommunityId },
    });
    if (!current) {
      throw new AthletesError("ATHLETES_CALENDAR_ENTRY_NOT_FOUND", "Calendar event not found");
    }
    if (current.status === "CANCELLED") return toEntry(current);
    const row = await this.tx.athletesCalendarEntry.update({
      where: { id: entryId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
    return toEntry(row);
  }
}

export class PrismaAthletesCalendarRepository
  implements AthletesCalendarRepository, AthletesCalendarUnitOfWork
{
  constructor(private readonly db: PrismaClient) {}

  async listForCommunity(athletesCommunityId: string, from: Date, to: Date) {
    const rows = await this.db.athletesCalendarEntry.findMany({
      where: { athletesCommunityId, startsAt: { gte: from, lt: to } },
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toEntry);
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
