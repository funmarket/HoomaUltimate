import type { PrismaClient, Prisma } from "@hooma/database";
import type {
  AthletesCalendarEntry,
  AthletesCalendarEntryCreateInput,
  AthletesCalendarEntryUpdateInput,
} from "@hooma/contracts/athletes-calendar";
import type { AthletesCalendarRepository } from "../application/athletes-calendar.repository.js";
import { AthletesError } from "../domain/athletes-error.js";

type CalendarRow = {
  id: string;
  athletesCommunityId: string;
  createdByUserId: string;
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

export class PrismaAthletesCalendarRepository implements AthletesCalendarRepository {
  constructor(private readonly db: PrismaClient) {}

  private async lockActiveCommunity(
    tx: Prisma.TransactionClient,
    athletesCommunityId: string,
    mode: "SHARE" | "UPDATE",
  ): Promise<void> {
    const rows =
      mode === "SHARE"
        ? await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "AthletesCommunity"
            WHERE "id" = ${athletesCommunityId} AND "status" = 'ACTIVE'
            FOR SHARE
          `
        : await tx.$queryRaw<Array<{ id: string }>>`
            SELECT "id" FROM "AthletesCommunity"
            WHERE "id" = ${athletesCommunityId} AND "status" = 'ACTIVE'
            FOR UPDATE
          `;
    if (!rows.length) {
      throw new AthletesError("ATHLETES_NOT_FOUND", "Athletes community not found");
    }
  }

  listForCommunity(athletesCommunityId: string, from: Date, to: Date) {
    return this.db.$transaction(async (tx) => {
      await this.lockActiveCommunity(tx, athletesCommunityId, "SHARE");
      const rows = await tx.athletesCalendarEntry.findMany({
        where: { athletesCommunityId, startsAt: { gte: from, lt: to } },
        orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      });
      return rows.map(toEntry);
    });
  }

  create(
    athletesCommunityId: string,
    createdByUserId: string,
    input: AthletesCalendarEntryCreateInput,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lockActiveCommunity(tx, athletesCommunityId, "UPDATE");
      const row = await tx.athletesCalendarEntry.create({
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
    });
  }

  update(
    athletesCommunityId: string,
    entryId: string,
    input: AthletesCalendarEntryUpdateInput,
  ) {
    return this.db.$transaction(async (tx) => {
      await this.lockActiveCommunity(tx, athletesCommunityId, "UPDATE");
      const current = await tx.athletesCalendarEntry.findFirst({
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
      const row = await tx.athletesCalendarEntry.update({
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
    });
  }

  cancel(athletesCommunityId: string, entryId: string) {
    return this.db.$transaction(async (tx) => {
      await this.lockActiveCommunity(tx, athletesCommunityId, "UPDATE");
      const current = await tx.athletesCalendarEntry.findFirst({
        where: { id: entryId, athletesCommunityId },
      });
      if (!current) {
        throw new AthletesError("ATHLETES_CALENDAR_ENTRY_NOT_FOUND", "Calendar event not found");
      }
      if (current.status === "CANCELLED") return toEntry(current);
      const row = await tx.athletesCalendarEntry.update({
        where: { id: entryId },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      return toEntry(row);
    });
  }
}
