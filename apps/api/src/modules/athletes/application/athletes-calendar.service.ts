import { randomUUID } from "node:crypto";
import {
  ATHLETES_PHOTO_MAX_BYTES,
  athletesPhotoContentTypeSchema,
  type AthletesCalendarCreateInput,
  type AthletesCalendarEntry,
  type AthletesCalendarEntryView,
  type AthletesCalendarListQuery,
  type AthletesCalendarMediaDelivery,
  type AthletesCalendarMediaUploadResponse,
  type AthletesCalendarRsvpResult,
  type AthletesCalendarRsvpStatus,
  type AthletesCalendarUpdateInput,
} from "@hooma/contracts/athletes";
import type { ObjectStorage, ObjectStorageReadUrlSigner } from "@hooma/storage";
import { AthletesError } from "../domain/athletes-error.js";
import {
  AthletesContentAuthorization,
  type AthletesContentAuthorizer,
} from "./athletes-content-authorizer.js";
import type {
  AthletesCalendarEntryViewRecord,
  AthletesCalendarMediaRecord,
  AthletesCalendarRecord,
  AthletesCalendarRepository,
  AthletesCalendarTransactionRepository,
} from "./athletes-calendar.repository.js";
import type { AthletesCalendarUnitOfWork } from "./athletes-calendar.unit-of-work.js";
import type { AthletesPhotoOptimizer } from "./athletes-photo-optimizer.js";
import type { AthletesPhotoValidator } from "./athletes-photo-validator.js";

const ATHLETES_CALENDAR_MEDIA_READ_URL_TTL_SECONDS = 5 * 60;

export interface AthletesCalendarMediaUploadInput {
  readonly contentType: string;
  readonly body: Uint8Array;
}

function serialize(record: AthletesCalendarRecord): AthletesCalendarEntry {
  return {
    id: record.id,
    athletesCommunityId: record.athletesCommunityId,
    title: record.title,
    description: record.description,
    location: record.location,
    photoUrl: record.photoUrl,
    photoMediaId: record.photoMediaId,
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

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function calendarMediaObjectKey(athletesCommunityId: string, mediaId: string): string {
  return `athletes-calendar-media/${athletesCommunityId}/${mediaId}`;
}

function supportsReadUrlSigning(
  storage: ObjectStorage,
): storage is ObjectStorage & ObjectStorageReadUrlSigner {
  return "createReadUrl" in storage && typeof storage.createReadUrl === "function";
}

function mediaFields(media: AthletesCalendarMediaRecord | null, photoUrl: string | null) {
  return {
    photoUrl,
    photoMediaId: media?.mediaId ?? null,
    photoObjectKey: media?.objectKey ?? null,
    photoContentType: media?.contentType ?? null,
    photoSizeBytes: media?.sizeBytes ?? null,
  };
}

function mediaFromRecord(record: AthletesCalendarRecord): AthletesCalendarMediaRecord | null {
  if (
    !record.photoMediaId ||
    !record.photoObjectKey ||
    !record.photoContentType ||
    !record.photoSizeBytes
  ) {
    return null;
  }
  return {
    mediaId: record.photoMediaId,
    athletesCommunityId: record.athletesCommunityId,
    objectKey: record.photoObjectKey,
    contentType: record.photoContentType,
    sizeBytes: record.photoSizeBytes,
  };
}

async function resolveNewMedia(
  calendar: AthletesCalendarTransactionRepository,
  athletesCommunityId: string,
  mediaId: string | null | undefined,
): Promise<AthletesCalendarMediaRecord | null> {
  if (!mediaId) return null;
  const media = await calendar.consumePreparedMedia(mediaId, athletesCommunityId);
  if (!media) {
    throw new AthletesError(
      "ATHLETES_CALENDAR_MEDIA_NOT_FOUND",
      "Athletes Calendar event photo upload was not found or has expired",
    );
  }
  return media;
}

export class AthletesCalendarService {
  constructor(
    private readonly authorization: AthletesContentAuthorizer,
    private readonly repository: AthletesCalendarRepository,
    private readonly unitOfWork: AthletesCalendarUnitOfWork,
    private readonly storage: ObjectStorage | null,
    private readonly validator: AthletesPhotoValidator,
    private readonly optimizer: AthletesPhotoOptimizer,
  ) {}

  async list(
    userId: string,
    athletesCommunityId: string,
    query: AthletesCalendarListQuery,
  ): Promise<{ items: AthletesCalendarEntryView[]; nextCursor: string | null }> {
    await this.authorization.requireMemberContent(userId, athletesCommunityId);
    const page = await this.repository.listForCommunity(
      athletesCommunityId,
      {
        range: {
          from: new Date(query.from),
          to: new Date(query.to),
        },
        limit: query.limit ?? 50,
        ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
      },
      userId,
    );
    return { items: page.items.map(serializeView), nextCursor: page.nextCursor };
  }

  async uploadMedia(
    userId: string,
    athletesCommunityId: string,
    input: AthletesCalendarMediaUploadInput,
  ): Promise<AthletesCalendarMediaUploadResponse> {
    await this.authorization.requireFounderContent(userId, athletesCommunityId);

    const contentType = normalizeContentType(input.contentType);
    const parsedContentType = athletesPhotoContentTypeSchema.safeParse(contentType);
    if (!parsedContentType.success) {
      throw new AthletesError(
        "ATHLETES_CALENDAR_MEDIA_TYPE_INVALID",
        "Athletes Calendar event photo must be JPEG, PNG, or WebP",
      );
    }
    if (!input.body.byteLength) {
      throw new AthletesError(
        "ATHLETES_CALENDAR_MEDIA_REQUIRED",
        "Athletes Calendar event photo bytes are required",
      );
    }
    if (input.body.byteLength > ATHLETES_PHOTO_MAX_BYTES) {
      throw new AthletesError(
        "ATHLETES_CALENDAR_MEDIA_TOO_LARGE",
        "Athletes Calendar event photo must be 5 MiB or smaller",
      );
    }
    if (!this.storage) {
      throw new AthletesError(
        "ATHLETES_CALENDAR_MEDIA_STORAGE_NOT_CONFIGURED",
        "Athletes Calendar event photo storage is not configured",
      );
    }

    await this.validator.validate(input.body, parsedContentType.data);
    const optimized = await this.optimizer.optimize(input.body, parsedContentType.data);
    const mediaId = randomUUID();
    const requestedObjectKey = calendarMediaObjectKey(athletesCommunityId, mediaId);
    await this.repository.prepareMediaUpload(mediaId, athletesCommunityId, requestedObjectKey);

    try {
      const stored = await this.storage.put(
        requestedObjectKey,
        optimized.body,
        optimized.contentType,
      );
      if (stored.key !== requestedObjectKey) {
        await this.repository.prepareMediaUpload(mediaId, athletesCommunityId, stored.key);
      }
      const storedContentType = athletesPhotoContentTypeSchema.parse(stored.contentType);
      await this.repository.completeMediaUpload({
        mediaId,
        athletesCommunityId,
        objectKey: stored.key,
        contentType: storedContentType,
        sizeBytes: stored.sizeBytes,
      });
      return { mediaId };
    } catch {
      throw new AthletesError(
        "ATHLETES_CALENDAR_MEDIA_UPLOAD_FAILED",
        "Athletes Calendar event photo upload failed",
      );
    }
  }

  async discardPreparedMedia(
    userId: string,
    athletesCommunityId: string,
    mediaId: string,
  ): Promise<void> {
    await this.authorization.requireFounderContent(userId, athletesCommunityId);
    await this.repository.expeditePreparedMediaCleanup(mediaId, athletesCommunityId);
  }

  async mediaDelivery(
    userId: string,
    athletesCommunityId: string,
    entryId: string,
  ): Promise<AthletesCalendarMediaDelivery> {
    await this.authorization.requireMemberContent(userId, athletesCommunityId);
    const entry = await this.repository.getForCommunity(athletesCommunityId, entryId);
    if (!entry?.photoMediaId || !entry.photoObjectKey) {
      throw new AthletesError(
        "ATHLETES_CALENDAR_MEDIA_NOT_FOUND",
        "Athletes Calendar event photo not found",
      );
    }
    if (!this.storage || !supportsReadUrlSigning(this.storage)) {
      throw new AthletesError(
        "ATHLETES_CALENDAR_MEDIA_STORAGE_NOT_CONFIGURED",
        "Athletes Calendar event photo storage is not configured",
      );
    }

    const issuedAt = Date.now();
    try {
      return {
        contentUrl: await this.storage.createReadUrl(
          entry.photoObjectKey,
          ATHLETES_CALENDAR_MEDIA_READ_URL_TTL_SECONDS,
        ),
        expiresAt: new Date(
          issuedAt + ATHLETES_CALENDAR_MEDIA_READ_URL_TTL_SECONDS * 1000,
        ).toISOString(),
      };
    } catch {
      throw new AthletesError(
        "ATHLETES_CALENDAR_MEDIA_UNAVAILABLE",
        "Athletes Calendar event photo is unavailable",
      );
    }
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
      const media = await resolveNewMedia(scope.calendar, athletesCommunityId, input.photoMediaId);
      return serialize(
        await scope.calendar.create({
          id: randomUUID(),
          athletesCommunityId,
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          ...mediaFields(media, input.photoUrl ?? null),
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

      const mediaFieldsChanged = input.photoUrl !== undefined || input.photoMediaId !== undefined;
      let nextMedia = mediaFromRecord(current);
      let nextPhotoUrl = current.photoUrl;
      if (mediaFieldsChanged) {
        nextMedia = await resolveNewMedia(scope.calendar, athletesCommunityId, input.photoMediaId);
        nextPhotoUrl = input.photoUrl ?? null;
      }

      const updated = await scope.calendar.update(athletesCommunityId, entryId, {
        title: input.title ?? current.title,
        description: input.description === undefined ? current.description : input.description,
        location: input.location === undefined ? current.location : input.location,
        ...mediaFields(nextMedia, nextPhotoUrl),
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

      const previousMedia = mediaFromRecord(current);
      if (previousMedia && previousMedia.mediaId !== updated.photoMediaId) {
        await scope.calendar.scheduleMediaCleanup(previousMedia);
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
