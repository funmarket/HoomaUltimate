import type {
  AthletesCalendarEntry,
  AthletesCalendarEntryCreateInput,
  AthletesCalendarEntryUpdateInput,
} from "@hooma/contracts/athletes-calendar";

export interface AthletesCalendarRepository {
  listForCommunity(
    athletesCommunityId: string,
    from: Date,
    to: Date,
  ): Promise<AthletesCalendarEntry[]>;

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
