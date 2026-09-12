import type { AthletesCalendarEntryCreateInput, AthletesCalendarEntryUpdateInput } from "@hooma/contracts/athletes-calendar";
import type { AthletesRepository } from "./athletes.repository.js";
import type { AthletesCalendarEntry } from "@hooma/contracts/athletes-calendar";

export interface AthletesCalendarTransactionRepository {
  create(
    athletesCommunityId: string,
    createdByUserId: string,
    input: AthletesCalendarEntryCreateInput,
  ): Promise<AthletesCalendarEntry>;
  update(
    athletesCommunityId: string,
    entryId: string,
    input: AthletesCalendarEntryUpdateInput,
  ): Promise<AthletesCalendarEntry>;
  cancel(athletesCommunityId: string, entryId: string): Promise<AthletesCalendarEntry>;
}

export interface AthletesCalendarTransactionScope {
  readonly athletes: AthletesRepository;
  readonly calendar: AthletesCalendarTransactionRepository;
}

export interface AthletesCalendarUnitOfWork {
  withCommunityLock<T>(
    athletesCommunityId: string,
    operation: (scope: AthletesCalendarTransactionScope) => Promise<T>,
  ): Promise<T>;
}
