import type { AthletesCalendarRsvpStatus } from "@hooma/contracts/athletes";

export interface AthletesCalendarRecord {
  readonly id: string;
  readonly athletesCommunityId: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly cancelledAt: Date | null;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AthletesCalendarRsvpCountsRecord {
  readonly going: number;
  readonly maybe: number;
  readonly notGoing: number;
}

export interface AthletesCalendarEntryViewRecord {
  readonly entry: AthletesCalendarRecord;
  readonly viewerStatus: AthletesCalendarRsvpStatus | null;
  readonly counts: AthletesCalendarRsvpCountsRecord;
}

export interface AthletesCalendarCreateRecordInput {
  readonly id: string;
  readonly athletesCommunityId: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly createdByUserId: string;
}

export interface AthletesCalendarUpdateRecordInput {
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
}

export interface AthletesCalendarRsvpUpsertInput {
  readonly id: string;
  readonly calendarEntryId: string;
  readonly userId: string;
  readonly status: AthletesCalendarRsvpStatus;
}

export interface AthletesCalendarRepository {
  listForCommunity(
    athletesCommunityId: string,
    range: { readonly from: Date; readonly to: Date },
    viewerUserId: string,
  ): Promise<AthletesCalendarEntryViewRecord[]>;
}

export interface AthletesCalendarTransactionRepository {
  create(input: AthletesCalendarCreateRecordInput): Promise<AthletesCalendarRecord>;
  update(
    athletesCommunityId: string,
    entryId: string,
    input: AthletesCalendarUpdateRecordInput,
  ): Promise<AthletesCalendarRecord | null>;
  cancel(
    athletesCommunityId: string,
    entryId: string,
    cancelledAt: Date,
  ): Promise<AthletesCalendarRecord | null>;
  getForCommunity(
    athletesCommunityId: string,
    entryId: string,
  ): Promise<AthletesCalendarRecord | null>;
  upsertRsvp(input: AthletesCalendarRsvpUpsertInput): Promise<void>;
}
