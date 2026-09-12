import type {
  AthletesCalendarEntryCreateInput,
  AthletesCalendarEntryUpdateInput,
  AthletesCalendarRange,
} from "@hooma/contracts/athletes-calendar";
import {
  AthletesContentAuthorization,
  type AthletesContentAuthorizer,
} from "./athletes-content-authorizer.js";
import type { AthletesCalendarRepository } from "./athletes-calendar.repository.js";
import type {
  AthletesCalendarTransactionRepository,
  AthletesCalendarUnitOfWork,
} from "./athletes-calendar.unit-of-work.js";

type AthletesCalendarPersistence = AthletesCalendarRepository &
  AthletesCalendarUnitOfWork;

export class AthletesCalendarService {
  constructor(
    private readonly authorizer: AthletesContentAuthorizer,
    private readonly persistence: AthletesCalendarPersistence,
  ) {}

  async list(
    userId: string,
    athletesCommunityId: string,
    range: AthletesCalendarRange,
  ) {
    await this.authorizer.requireMemberContent(userId, athletesCommunityId);
    return this.persistence.listForCommunity(
      athletesCommunityId,
      new Date(range.from),
      new Date(range.to),
    );
  }

  create(
    userId: string,
    athletesCommunityId: string,
    input: AthletesCalendarEntryCreateInput,
  ) {
    return this.withFounderLock(userId, athletesCommunityId, (calendar) =>
      calendar.create(athletesCommunityId, userId, input),
    );
  }

  update(
    userId: string,
    athletesCommunityId: string,
    entryId: string,
    input: AthletesCalendarEntryUpdateInput,
  ) {
    return this.withFounderLock(userId, athletesCommunityId, (calendar) =>
      calendar.update(athletesCommunityId, entryId, input),
    );
  }

  cancel(userId: string, athletesCommunityId: string, entryId: string) {
    return this.withFounderLock(userId, athletesCommunityId, (calendar) =>
      calendar.cancel(athletesCommunityId, entryId),
    );
  }

  private withFounderLock<T>(
    userId: string,
    athletesCommunityId: string,
    operation: (calendar: AthletesCalendarTransactionRepository) => Promise<T>,
  ): Promise<T> {
    return this.persistence.withCommunityLock(
      athletesCommunityId,
      async (scope) => {
        const lockedAuthorization = new AthletesContentAuthorization(scope.athletes);
        await lockedAuthorization.requireFounderContent(
          userId,
          athletesCommunityId,
        );
        return operation(scope.calendar);
      },
    );
  }
}
