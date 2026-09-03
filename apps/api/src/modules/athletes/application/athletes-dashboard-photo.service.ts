import { randomUUID } from "node:crypto";
import type { ObjectStorage } from "@hooma/storage";
import { AthletesError } from "../domain/athletes-error.js";
import type { AthletesService } from "./athletes.service.js";
import type { AthletesDashboardPhotoRepository } from "./athletes-dashboard-photo.repository.js";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function normalizedContentType(value: string | undefined): string {
  return (value ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function serializePhoto(record: {
  readonly id: string;
  readonly athletesCommunityId: string;
  readonly createdAt: Date;
}) {
  return {
    id: record.id,
    athletesCommunityId: record.athletesCommunityId,
    createdAt: record.createdAt.toISOString(),
  };
}

export class AthletesDashboardPhotoService {
  constructor(
    private readonly repository: AthletesDashboardPhotoRepository,
    private readonly athletesService: AthletesService,
    private readonly storage: ObjectStorage | null,
  ) {}

  async list(userId: string, athletesCommunityId: string) {
    await this.athletesService.requireMemberContent(userId, athletesCommunityId);
    const photos = await this.repository.list(athletesCommunityId, 24);
    return { photos: photos.map(serializePhoto) };
  }

  async post(
    userId: string,
    athletesCommunityId: string,
    input: { readonly contentType?: string; readonly body: Uint8Array },
  ) {
    const detail = await this.athletesService.getPublic(athletesCommunityId, userId);
    if (detail.viewerRole !== "FOUNDER") {
      throw new AthletesError(
        "ATHLETES_FOUNDER_REQUIRED",
        "Only the Athletes Founder can post dashboard photos",
      );
    }

    const contentType = normalizedContentType(input.contentType);
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new AthletesError("ATHLETES_PHOTO_TYPE_INVALID", "Photo must be JPEG, PNG, or WebP");
    }
    if (!input.body.byteLength) {
      throw new AthletesError("ATHLETES_PHOTO_REQUIRED", "Photo is required");
    }
    if (input.body.byteLength > MAX_PHOTO_BYTES) {
      throw new AthletesError("ATHLETES_PHOTO_TOO_LARGE", "Photo must be 5 MB or smaller");
    }
    if (!this.storage) {
      throw new AthletesError(
        "ATHLETES_PHOTO_STORAGE_NOT_CONFIGURED",
        "Photo storage is not configured",
      );
    }

    const id = randomUUID();
    const objectKey = `athletes/dashboard/${athletesCommunityId}/${id}`;
    try {
      await this.storage.put(objectKey, input.body, contentType);
    } catch {
      throw new AthletesError("ATHLETES_PHOTO_UPLOAD_FAILED", "Unable to store dashboard photo");
    }

    try {
      const record = await this.repository.create({
        id,
        athletesCommunityId,
        authorUserId: userId,
        objectKey,
        contentType,
        sizeBytes: input.body.byteLength,
      });
      return { photo: serializePhoto(record) };
    } catch (error) {
      try {
        await this.storage.remove(objectKey);
      } catch {
        // Best-effort rollback; metadata remains the source of truth for access.
      }
      throw error;
    }
  }

  async getPhoto(userId: string, athletesCommunityId: string, photoId: string) {
    await this.athletesService.requireMemberContent(userId, athletesCommunityId);
    const record = await this.repository.get(athletesCommunityId, photoId);
    if (!record) {
      throw new AthletesError("ATHLETES_PHOTO_NOT_FOUND", "Athletes dashboard photo not found");
    }
    if (!this.storage) {
      throw new AthletesError(
        "ATHLETES_PHOTO_STORAGE_NOT_CONFIGURED",
        "Photo storage is not configured",
      );
    }
    const stored = await this.storage.get(record.objectKey);
    if (!stored) {
      throw new AthletesError("ATHLETES_PHOTO_UNAVAILABLE", "Athletes dashboard photo unavailable");
    }
    return stored;
  }
}
