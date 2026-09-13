import type { AthletesCalendarEntry } from "@hooma/contracts/athletes-calendar";

export interface AthletesCalendarRepository {
  listForCommunity(
    athletesCommunityId: string,
    from: Date,
    to: Date,
  ): Promise<AthletesCalendarEntry[]>;
}
