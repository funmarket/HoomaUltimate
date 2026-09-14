import { randomUUID } from "node:crypto";
import type {
  AthletesCalendarCreateInput,
  AthletesCalendarEntry,
  AthletesCalendarEntryView,
  AthletesCalendarListQuery,
  AthletesCalendarRsvpResult,
  AthletesCalendarRsvpStatus,
  AthletesCalendarUpdateInput,
} from "@hooma/contracts/athletes";
import { AthletesError } from "../domain/athletes-error.js";
import {
  AthletesContentAuthorization,
  type AthletesContentAuthorizer,
} from "./athletes-content-authorizer.js";
import type {
  AthletesCalendarEntryViewRecord,
  AthletesCalendarRecord,
  AthletesCalendarRepository,
} from "./athletes-calendar.repository.js";
import type { AthletesCalendarUnitOfWork } from "./athletes-calendar.unit-of-work.js";

function serialize(record: AthletesCalendarRecord): AthletesCalendarEntry {
  return {
    id: record.id,
    athletesCommunityId: record.athletesCommunityId,
    title: record.title,
    description: record.description,
    location: record.location,
    startsAt: record.startsAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    timezone: record.timezone,
    cancelledAt: record.cancelledAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function serializeView(record: AthletesCalendarEntryViewRecord): AthletesCalendarEntryView {
  return {
    ...serialize(record.entry),
    rsvp: {
      viewerStatus: record.viewerStatus,
      counts: record.counts,
    },
  };
}

function requireValidInterval(startsAt: Date, endsAt: Date): void {
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new AthletesError(
      "ATHLETES_CALENDAR_TIME_INVALID",
      "Calendar entry must end after it starts",
    );
  }
}

export class AthletesCalendarService {
  constructor(
    private readonly authorization: AthletesContentAuthorizer,
    private readonly repository: AthletesCalendarRepository,
    private readonly unitOfWork: AthletesCalendarUnitOfWork,
  ) {}

  async list(
    userId: string,
    athletesCommunityId: string,
    query: AthletesCalendarListQuery,
  ): Promise<AthletesCalendarEntryView[]> {
    await this.authorization.requireMemberContent(userId, athletesCommunityId);
    const rows = await this.repository.listForCommunity(
      athletesCommunityId,
      {
        from: new Date(query.from),
        to: new Date(query.to),
      },
      userId,
    );
    return rows.map(serializeView);
  }

  create(
    userId: string,
    athletesCommunityId: string,
    input: AthletesCalendarCreateInput,
  ): Promise<AthletesCalendarEntry> {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    requireValidInterval(startsAt, endsAt);
    return this.unitOfWork.withCommunityLock(athletesCommunityId, async (scope) => {
      await new AthletesContentAuthorization(scope.athletes).requireFounderContent(
        userId,
        athletesCommunityId,
      );
      return serialize(
        await scope.calendar.create({
          id: randomUUID(),
          athletesCommunityId,
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          startsAt,
          endsAt,
          timezone: input.timezone,
          createdByUserId: userId,
        }),
      );
    });
  }

  update(
    userId: string,
    athletesCommunityId: string,
    entryId: string,
    input: AthletesCalendarUpdateInput,
  ): Promise<AthletesCalendarEntry> {
    return this.unitOfWork.withCommunityLock(athletesCommunityId, async (scope) => {
      await new AthletesContentAuthorization(scope.athletes).requireFounderContent(
        userId,
        athletesCommunityId,
      );
      const current = await scope.calendar.getForCommunity(athletesCommunityId, entryId);
      if (!current) {
        throw new AthletesError(
          "ATHLETES_CALENDAR_ENTRY_NOT_FOUND",
          "Athletes Calendar entry not found",
        );
      }
      if (current.cancelledAt) {
        throw new AthletesError(
          "ATHLETES_CALENDAR_ENTRY_CANCELLED",
          "Cancelled Athletes Calendar entries cannot be edited",
        );
      }
      const startsAt = input.startsAt ? new Date(input.startsAt) : current.startsAt;
      const endsAt = input.endsAt ? new Date(input.endsAt) : current.endsAt;
      requireValidInterval(startsAt, endsAt);
      const updated = await scope.calendar.update(athletesCommunityId, entryId, {
        title: input.title ?? current.title,
        description: input.description === undefined ? current.description : input.description,
        location: input.location === undefined ? current.location : input.location,
        startsAt,
        endsAt,
        timezone: input.timezone ?? current.timezone,
      });
      if (!updated) {
        throw new AthletesError(
          "ATHLETES_CALENDAR_ENTRY_NOT_FOUND",
          "Athletes Calendar entry not found",
        );
      }
      return serialize(updated);
    });
  }

  cancel(
    userId: string,
    athletesCommunityId: string,
    entryId: string,
  ): Promise<AthletesCalendarEntry> {
    return this.unitOfWork.withCommunityLock(athletesCommunityId, async (scope) => {
      await new AthletesContentAuthorization(scope.athletes).requireFounderContent(
        userId,
        athletesCommunityId,
      );
      const current = await scope.calendar.getForCommunity(athletesCommunityId, entryId);
      if (!current) {
        throw new AthletesError(
          "ATHLETES_CALENDAR_ENTRY_NOT_FOUND",
          "Athletes Calendar entry not found",
        );
      }
      if (current.cancelledAt) return serialize(current);
      const cancelled = await scope.calendar.cancel(athletesCommunityId, entryId, new Date());
      if (!cancelled) {
        throw new AthletesError(
          "ATHLETES_CALENDAR_ENTRY_NOT_FOUND",
          "Athletes Calendar entry not found",
        );
      }
      return serialize(cancelled);
    });
  }

  setRsvp(
    userId: string,
    athletesCommunityId: string,
    entryId: string,
    status: AthletesCalendarRsvpStatus,
  ): Promise<AthletesCalendarRsvpResult> {
    return this.unitOfWork.withCommunitySharedLock(athletesCommunityId, async (scope) => {
      await new AthletesContentAuthorization(scope.athletes).requireMemberContent(
        userId,
        athletesCommunityId,
      );
      const current = await scope.calendar.getForCommunity(athletesCommunityId, entryId);
      if (!current) {
        throw new AthletesError(
          "ATHLETES_CALENDAR_ENTRY_NOT_FOUND",
          "Athletes Calendar entry not found",
        );
      }
      if (current.cancelledAt) {
        throw new AthletesError(
          "ATHLETES_CALENDAR_ENTRY_CANCELLED",
          "Cancelled Athletes Calendar entries cannot accept RSVP changes",
        );
      }
      await scope.calendar.upsertRsvp({
        id: randomUUID(),
        calendarEntryId: entryId,
        userId,
        status,
      });
      return { entryId, status };
    });
  }
}
