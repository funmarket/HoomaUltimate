import type { AthletesRepository } from "./athletes.repository.js";
import type { AthletesCalendarTransactionRepository } from "./athletes-calendar.repository.js";

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
