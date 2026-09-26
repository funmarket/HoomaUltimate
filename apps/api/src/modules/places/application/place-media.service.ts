import { randomUUID } from "node:crypto";
import {
  PLACE_APP_ADMIN_IMAGE_LIMIT,
  PLACE_IMAGE_CONTENT_TYPES,
  PLACE_IMAGE_MAX_BYTES,
  PLACE_OWNER_IMAGE_LIMIT,
  placeExternalImageInputSchema,
  placeImageOrderSchema,
  type PlaceExternalImageInput,
  type PlaceImageContentType,
  type PlaceImageOrderInput,
} from "@hooma/contracts/places";
import type { ObjectStorage, ObjectStorageReadUrlSigner } from "@hooma/storage";
import type { PlatformAdminAccessPort } from "../../../application/platform-admin-access.port.js";
import { PlaceMediaError } from "../domain/place-media-error.js";
import type { ExternalPlaceImageResolver } from "./external-place-image-resolver.js";
import type { PlaceImageProcessor } from "./place-image-processor.js";
import type { PlaceRepository } from "./place.repository.js";

const PLACE_IMAGE_READ_URL_TTL_SECONDS = 5 * 60;
const PLACE_IMAGE_TYPES = new Set<string>(PLACE_IMAGE_CONTENT_TYPES);

export interface PlaceImageUploadInput {
  readonly contentType: string;
  readonly body: Uint8Array;
}

function managedImagePath(placeId: string, imageId: string): string {
  return `/api/public/v1/places/${encodeURIComponent(placeId)}/images/${encodeURIComponent(imageId)}/content`;
}

function objectKey(placeId: string, imageId: string): string {
  return `place-images/${placeId}/${imageId}`;
}

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function supportsReadUrlSigning(
  storage: ObjectStorage,
): storage is ObjectStorage & ObjectStorageReadUrlSigner {
  return "createReadUrl" in storage && typeof storage.createReadUrl === "function";
}

export class PlaceMediaService {
  constructor(
    private readonly places: PlaceRepository,
    private readonly platformAdmin: PlatformAdminAccessPort,
    private readonly externalResolver: ExternalPlaceImageResolver,
    private readonly storage: ObjectStorage | null,
    private readonly processor: PlaceImageProcessor,
  ) {}

  async addExternal(userId: string, placeId: string, input: PlaceExternalImageInput) {
    const maxImages = await this.requireMediaAccess(userId, placeId);
    const parsed = placeExternalImageInputSchema.parse(input);
    const imageUrl = await this.externalResolver.resolve(parsed.url);
    return this.addImage(placeId, randomUUID(), imageUrl, maxImages);
  }

  async addUpload(userId: string, placeId: string, input: PlaceImageUploadInput) {
    const maxImages = await this.requireMediaAccess(userId, placeId);
    const contentType = normalizeContentType(input.contentType);
    if (!PLACE_IMAGE_TYPES.has(contentType)) {
      throw new PlaceMediaError(
        "PLACE_IMAGE_TYPE_INVALID",
        "Place photo must be JPEG, PNG, or WebP",
      );
    }
    if (!input.body.byteLength) {
      throw new PlaceMediaError("PLACE_IMAGE_REQUIRED", "Place photo bytes are required");
    }
    if (input.body.byteLength > PLACE_IMAGE_MAX_BYTES) {
      throw new PlaceMediaError(
        "PLACE_IMAGE_TOO_LARGE",
        "Place photo must be 5 MiB or smaller",
      );
    }
    if (!this.storage) {
      throw new PlaceMediaError(
        "PLACE_IMAGE_STORAGE_NOT_CONFIGURED",
        "Place photo storage is not configured",
      );
    }

    const imageId = randomUUID();
    const key = objectKey(placeId, imageId);
    const processed = await this.processor.process(
      input.body,
      contentType as PlaceImageContentType,
    );
    let uploaded = false;
    try {
      await this.storage.put(key, processed.body, processed.contentType);
      uploaded = true;
      return await this.addImage(placeId, imageId, managedImagePath(placeId, imageId), maxImages);
    } catch (error) {
      if (uploaded) {
        try {
          await this.storage.remove(key);
        } catch {
          // Preserve the original failure; orphan cleanup can be retried operationally.
        }
      }
      throw error;
    }
  }

  async delete(userId: string, placeId: string, imageId: string) {
    await this.requireMediaAccess(userId, placeId);
    const deleted = await this.places.deleteImage(placeId, imageId);
    if (!deleted) throw new PlaceMediaError("PLACE_IMAGE_NOT_FOUND", "Place photo not found");
    if (deleted.imageUrl === managedImagePath(placeId, imageId) && this.storage) {
      try {
        await this.storage.remove(objectKey(placeId, imageId));
      } catch {
        // Canonical gallery deletion remains authoritative.
      }
    }
    return { ok: true as const };
  }

  async reorder(userId: string, placeId: string, input: PlaceImageOrderInput) {
    await this.requireMediaAccess(userId, placeId);
    const parsed = placeImageOrderSchema.parse(input);
    try {
      return await this.places.reorderImages(placeId, parsed.imageIds);
    } catch (error) {
      if (error instanceof Error && error.message === "PLACE_IMAGE_ORDER_INVALID") {
        throw new PlaceMediaError(
          "PLACE_IMAGE_ORDER_INVALID",
          "Photo order must contain every photo once",
        );
      }
      throw error;
    }
  }

  async deliveryUrlPublic(placeId: string, imageId: string): Promise<string> {
    if (!(await this.places.getApproved(placeId))) {
      throw new PlaceMediaError("PLACE_NOT_FOUND", "Approved Place not found");
    }
    const image = await this.places.getImage(placeId, imageId);
    if (!image || image.imageUrl !== managedImagePath(placeId, imageId)) {
      throw new PlaceMediaError("PLACE_IMAGE_NOT_FOUND", "Place photo not found");
    }
    if (!this.storage || !supportsReadUrlSigning(this.storage)) {
      throw new PlaceMediaError(
        "PLACE_IMAGE_STORAGE_NOT_CONFIGURED",
        "Place photo storage is not configured",
      );
    }
    return this.storage.createReadUrl(
      objectKey(placeId, imageId),
      PLACE_IMAGE_READ_URL_TTL_SECONDS,
    );
  }

  private async requireMediaAccess(userId: string, placeId: string): Promise<number> {
    if (await this.platformAdmin.isPlatformAdmin(userId)) return PLACE_APP_ADMIN_IMAGE_LIMIT;
    if (await this.places.canManageOwnerMedia(placeId, userId)) return PLACE_OWNER_IMAGE_LIMIT;
    throw new PlaceMediaError(
      "PLACE_IMAGE_MANAGE_FORBIDDEN",
      "Verified owner, pending owner submitter, or App Admin access required",
    );
  }

  private async addImage(placeId: string, imageId: string, imageUrl: string, maxImages: number) {
    try {
      return await this.places.addImage(placeId, imageId, imageUrl, maxImages);
    } catch (error) {
      if (error instanceof Error && error.message === "PLACE_IMAGE_LIMIT_REACHED") {
        throw new PlaceMediaError(
          "PLACE_IMAGE_LIMIT_REACHED",
          `This gallery is already at its ${maxImages}-photo limit`,
        );
      }
      throw error;
    }
  }
}
