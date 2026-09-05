import { randomUUID } from "node:crypto";
import {
  ATHLETES_PHOTO_MAX_BYTES,
  athletesPhotoContentTypeSchema,
  type AthletesPhotoContentType,
  type AthletesPhotoList,
  type AthletesPhotoMetadata,
  type AthletesPhotoUploadResponse,
} from "@hooma/contracts/athletes";
import type { ObjectStorage } from "@hooma/storage";
import type { AthletesPhotoRecord, AthletesPhotoRepository } from "./athletes-photo.repository.js";
import type { AthletesService } from "./athletes.service.js";

export interface AthletesPhotoUploadInput {
  readonly contentType: string;
  readonly body: Uint8Array;
}

export interface AthletesPhotoBinary {
  readonly contentType: AthletesPhotoContentType;
  readonly body: Uint8Array;
}

type AthletesPhotoAuthorization = Pick<
  AthletesService,
  "requireFounderContent" | "requireMemberContent"
>;

export class AthletesPhotoService {
  constructor(
    private readonly athletes: AthletesPhotoAuthorization,
    private readonly photos: AthletesPhotoRepository,
    private readonly storage: ObjectStorage | null,
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
      throw new Error("Athletes photo must be JPEG, PNG, or WebP");
    }
    if (!input.body.byteLength) {
      throw new Error("Athletes photo bytes are required");
    }
    if (input.body.byteLength > ATHLETES_PHOTO_MAX_BYTES) {
      throw new Error("Athletes photo must be 5 MiB or smaller");
    }
    if (!this.storage) {
      throw new Error("Athletes photo storage is not configured");
    }

    const photoId = randomUUID();
    const requestedObjectKey = athletesPhotoObjectKey(athletesCommunityId, photoId);
    let uploadedObjectKey: string | null = null;

    try {
      const stored = await this.storage.put(requestedObjectKey, input.body, parsedContentType.data);
      uploadedObjectKey = stored.key;
      const storedContentType = athletesPhotoContentTypeSchema.parse(stored.contentType);

      const metadata = await this.photos.create({
        id: photoId,
        athletesCommunityId,
        objectKey: stored.key,
        contentType: storedContentType,
        sizeBytes: stored.sizeBytes,
        uploadedByUserId: userId,
      });

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
      }
      throw error;
    }
  }

  async list(userId: string, athletesCommunityId: string): Promise<AthletesPhotoList> {
    await this.athletes.requireMemberContent(userId, athletesCommunityId);
    return (await this.photos.listForCommunity(athletesCommunityId)).map(publicPhotoMetadata);
  }

  async read(
    userId: string,
    athletesCommunityId: string,
    photoId: string,
  ): Promise<AthletesPhotoBinary> {
    await this.athletes.requireMemberContent(userId, athletesCommunityId);
    const metadata = await this.photos.getForCommunity(athletesCommunityId, photoId);
    if (!metadata) throw new Error("Athletes photo not found");
    if (!this.storage) throw new Error("Athletes photo storage is not configured");

    const stored = await this.storage.get(metadata.objectKey);
    return {
      contentType: athletesPhotoContentTypeSchema.parse(metadata.contentType),
      body: stored.body,
    };
  }
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
