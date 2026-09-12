import { randomUUID } from "node:crypto";
import {
  ATHLETES_PHOTO_MAX_BYTES,
  athletesPhotoContentTypeSchema,
  type AthletesPhotoDelivery,
  type AthletesPhotoList,
  type AthletesPhotoMetadata,
  type AthletesPhotoUploadResponse,
} from "@hooma/contracts/athletes";
import type { ObjectStorage, ObjectStorageReadUrlSigner } from "@hooma/storage";
import { AthletesError } from "../domain/athletes-error.js";
import {
  AthletesContentAuthorization,
  type AthletesContentAuthorizer,
} from "./athletes-content-authorizer.js";
import type { AthletesPhotoOptimizer } from "./athletes-photo-optimizer.js";
import type { AthletesPhotoRecord, AthletesPhotoRepository } from "./athletes-photo.repository.js";
import type { AthletesPhotoUnitOfWork } from "./athletes-photo.unit-of-work.js";
import type { AthletesPhotoValidator } from "./athletes-photo-validator.js";

const ATHLETES_PHOTO_READ_URL_TTL_SECONDS = 5 * 60;

export interface AthletesPhotoUploadInput {
  readonly contentType: string;
  readonly body: Uint8Array;
}

export class AthletesPhotoService {
  constructor(
    private readonly athletes: AthletesContentAuthorizer,
    private readonly photos: AthletesPhotoRepository,
    private readonly photoUnitOfWork: AthletesPhotoUnitOfWork,
    private readonly storage: ObjectStorage | null,
    private readonly validator: AthletesPhotoValidator,
    private readonly optimizer: AthletesPhotoOptimizer,
  ) {}

  async upload(
    userId: string,
    athletesCommunityId: string,
    input: AthletesPhotoUploadInput,
  ): Promise<AthletesPhotoUploadResponse> {
    await this.athletes.requireFounderContent(userId, athletesCommunityId);

    const contentType = normalizeContentType(input.contentType);
    const parsedContentType = athletesPhotoContentTypeSchema.safeParse(contentType);
    if (!parsedContentType.success) {
      throw new AthletesError(
        "ATHLETES_PHOTO_TYPE_INVALID",
        "Athletes photo must be JPEG, PNG, or WebP",
      );
    }
    if (!input.body.byteLength) {
      throw new AthletesError("ATHLETES_PHOTO_REQUIRED", "Athletes photo bytes are required");
    }
    if (input.body.byteLength > ATHLETES_PHOTO_MAX_BYTES) {
      throw new AthletesError(
        "ATHLETES_PHOTO_TOO_LARGE",
        "Athletes photo must be 5 MiB or smaller",
      );
    }
    if (!this.storage) {
      throw new AthletesError(
        "ATHLETES_PHOTO_STORAGE_NOT_CONFIGURED",
        "Athletes photo storage is not configured",
      );
    }

    await this.validator.validate(input.body, parsedContentType.data);
    const optimized = await this.optimizer.optimize(input.body, parsedContentType.data);

    const photoId = randomUUID();
    const requestedObjectKey = athletesPhotoObjectKey(athletesCommunityId, photoId);
    // Persist recovery intent before writing bytes so a crash cannot erase the
    // only record of a pending upload. Successful metadata commits consume it.
    await this.photos.prepareUpload(photoId, athletesCommunityId, requestedObjectKey);
    let uploadedObjectKey: string | null = null;

    try {
      const stored = await this.storage.put(
        requestedObjectKey,
        optimized.body,
        optimized.contentType,
      );
      uploadedObjectKey = stored.key;
      if (stored.key !== requestedObjectKey) {
        await this.photos.prepareUpload(photoId, athletesCommunityId, stored.key);
      }
      const storedContentType = athletesPhotoContentTypeSchema.parse(stored.contentType);

      const metadata = await this.photoUnitOfWork.withCommunityLock(
        athletesCommunityId,
        async (scope) => {
          const lockedAuthorization = new AthletesContentAuthorization(scope.athletes);
          await lockedAuthorization.requireFounderContent(userId, athletesCommunityId);
          return scope.photos.createPrepared({
            id: photoId,
            athletesCommunityId,
            objectKey: stored.key,
            contentType: storedContentType,
            sizeBytes: stored.sizeBytes,
            uploadedByUserId: userId,
          });
        },
      );

      uploadedObjectKey = null;
      return publicPhotoMetadata(metadata);
    } catch (error) {
      if (uploadedObjectKey) {
        try {
          await this.storage.remove(uploadedObjectKey);
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            "Athletes photo metadata persistence failed and uploaded object cleanup also failed",
          );
        }
        throw error;
      }
      throw new AthletesError("ATHLETES_PHOTO_UPLOAD_FAILED", "Athletes photo upload failed");
    }
  }

  async list(
    userId: string,
    athletesCommunityId: string,
    page: { cursor?: string | undefined; limit: number } = { limit: 24 },
  ): Promise<AthletesPhotoList> {
    await this.athletes.requireMemberContent(userId, athletesCommunityId);
    return (await this.photos.listForCommunity(athletesCommunityId, page)).map(publicPhotoMetadata);
  }

  async delivery(
    userId: string,
    athletesCommunityId: string,
    photoId: string,
  ): Promise<AthletesPhotoDelivery> {
    await this.athletes.requireMemberContent(userId, athletesCommunityId);
    const metadata = await this.photos.getForCommunity(athletesCommunityId, photoId);
    if (!metadata) {
      throw new AthletesError("ATHLETES_PHOTO_NOT_FOUND", "Athletes photo not found");
    }
    if (!this.storage || !supportsReadUrlSigning(this.storage)) {
      throw new AthletesError(
        "ATHLETES_PHOTO_STORAGE_NOT_CONFIGURED",
        "Athletes photo storage is not configured",
      );
    }

    const issuedAt = Date.now();
    try {
      return {
        contentUrl: await this.storage.createReadUrl(
          metadata.objectKey,
          ATHLETES_PHOTO_READ_URL_TTL_SECONDS,
        ),
        expiresAt: new Date(issuedAt + ATHLETES_PHOTO_READ_URL_TTL_SECONDS * 1000).toISOString(),
      };
    } catch {
      throw new AthletesError("ATHLETES_PHOTO_UNAVAILABLE", "Athletes photo is unavailable");
    }
  }

  async delete(userId: string, athletesCommunityId: string, photoId: string): Promise<void> {
    await this.athletes.requireFounderContent(userId, athletesCommunityId);
    const deleted = await this.photoUnitOfWork.withCommunityLock(
      athletesCommunityId,
      async (scope) => {
        const lockedAuthorization = new AthletesContentAuthorization(scope.athletes);
        await lockedAuthorization.requireFounderContent(userId, athletesCommunityId);
        return scope.photos.deleteAndScheduleCleanup(athletesCommunityId, photoId);
      },
    );
    if (!deleted) {
      throw new AthletesError("ATHLETES_PHOTO_NOT_FOUND", "Athletes photo not found");
    }
  }
}

function supportsReadUrlSigning(
  storage: ObjectStorage,
): storage is ObjectStorage & ObjectStorageReadUrlSigner {
  return "createReadUrl" in storage && typeof storage.createReadUrl === "function";
}

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function athletesPhotoObjectKey(athletesCommunityId: string, photoId: string): string {
  return `athletes-photos/${athletesCommunityId}/${photoId}`;
}

function publicPhotoMetadata(metadata: AthletesPhotoRecord): AthletesPhotoMetadata {
  return {
    id: metadata.id,
    athletesCommunityId: metadata.athletesCommunityId,
    contentType: athletesPhotoContentTypeSchema.parse(metadata.contentType),
    sizeBytes: metadata.sizeBytes,
    createdAt: metadata.createdAt,
    updatedAt: metadata.updatedAt,
  };
}
