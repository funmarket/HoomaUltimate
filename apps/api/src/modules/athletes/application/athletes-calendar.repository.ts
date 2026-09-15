import type { AthletesCalendarRsvpStatus } from "@hooma/contracts/athletes";

export interface AthletesCalendarRecord {
  readonly id: string;
  readonly athletesCommunityId: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly photoUrl: string | null;
  readonly photoMediaId: string | null;
  readonly photoObjectKey: string | null;
  readonly photoContentType: string | null;
  readonly photoSizeBytes: number | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly cancelledAt: Date | null;
  readonly createdByUserId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AthletesCalendarMediaRecord {
  readonly mediaId: string;
  readonly athletesCommunityId: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
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

export interface AthletesCalendarListRecordInput {
  readonly range: { readonly from: Date; readonly to: Date };
  readonly cursor?: string;
  readonly limit: number;
}

export interface AthletesCalendarEntryViewPageRecord {
  readonly items: AthletesCalendarEntryViewRecord[];
  readonly nextCursor: string | null;
}

export interface AthletesCalendarCreateRecordInput {
  readonly id: string;
  readonly athletesCommunityId: string;
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly photoUrl: string | null;
  readonly photoMediaId: string | null;
  readonly photoObjectKey: string | null;
  readonly photoContentType: string | null;
  readonly photoSizeBytes: number | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timezone: string;
  readonly createdByUserId: string;
}

export interface AthletesCalendarUpdateRecordInput {
  readonly title: string;
  readonly description: string | null;
  readonly location: string | null;
  readonly photoUrl: string | null;
  readonly photoMediaId: string | null;
  readonly photoObjectKey: string | null;
  readonly photoContentType: string | null;
  readonly photoSizeBytes: number | null;
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
    input: AthletesCalendarListRecordInput,
    viewerUserId: string,
  ): Promise<AthletesCalendarEntryViewPageRecord>;
  getForCommunity(
    athletesCommunityId: string,
    entryId: string,
  ): Promise<AthletesCalendarRecord | null>;
  prepareMediaUpload(
    mediaId: string,
    athletesCommunityId: string,
    objectKey: string,
  ): Promise<void>;
  completeMediaUpload(input: AthletesCalendarMediaRecord): Promise<void>;
  expeditePreparedMediaCleanup(mediaId: string, athletesCommunityId: string): Promise<boolean>;
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
  consumePreparedMedia(
    mediaId: string,
    athletesCommunityId: string,
  ): Promise<AthletesCalendarMediaRecord | null>;
  scheduleMediaCleanup(media: AthletesCalendarMediaRecord): Promise<void>;
  upsertRsvp(input: AthletesCalendarRsvpUpsertInput): Promise<void>;
}
