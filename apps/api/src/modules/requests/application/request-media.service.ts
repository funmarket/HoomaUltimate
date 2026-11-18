import { randomUUID } from "node:crypto";
import {
  REQUEST_IMAGE_CONTENT_TYPES,
  REQUEST_IMAGE_MAX_BYTES,
  helpRequestExternalImageInputSchema,
  type HelpRequestExternalImageInput,
  type HelpRequestImage,
  type HelpRequestImageDelivery,
  type RequestImageContentType,
} from "@hooma/contracts/requests";
import {
  PHOTO_STANDARD,
  planMediaObjectKeys,
  writeMediaVariants,
  type MediaStorageScope,
} from "@hooma/media-processing";
import type { ObjectStorage, ObjectStorageReadUrlSigner } from "@hooma/storage";
import { RequestError } from "../domain/request-error.js";
import { requireManageRequest } from "./request-authorization.js";
import type { RequestImageProcessor } from "./request-image-processor.js";
import type { HelpRequestImageRecord, RequestImageRepository } from "./request-image.repository.js";
import type { RequestRepository, RequestVisibilityReader } from "./request.repository.js";

const REQUEST_IMAGE_READ_URL_TTL_SECONDS = 5 * 60;
const REQUEST_IMAGE_TYPES = new Set<string>(REQUEST_IMAGE_CONTENT_TYPES);

export interface RequestImageUploadInput {
  readonly contentType: string;
  readonly body: Uint8Array;
}

export class RequestMediaService {
  constructor(
    private readonly requests: RequestRepository,
    private readonly visibility: RequestVisibilityReader,
    private readonly images: RequestImageRepository,
    private readonly storage: ObjectStorage | null,
    private readonly processor: RequestImageProcessor,
    private readonly mediaStorageScope: MediaStorageScope | null,
  ) {}

  async replaceUpload(
    userId: string,
    requestId: string,
    input: RequestImageUploadInput,
  ): Promise<HelpRequestImage> {
    await requireManageRequest(this.requests, this.visibility, userId, requestId);
    const contentType = normalizeContentType(input.contentType);
    if (!REQUEST_IMAGE_TYPES.has(contentType)) {
      throw new RequestError(
        "REQUEST_IMAGE_TYPE_INVALID",
        "Request image must be JPEG, PNG, or WebP",
      );
    }
    if (!input.body.byteLength) {
      throw new RequestError("REQUEST_IMAGE_REQUIRED", "Request image bytes are required");
    }
    if (input.body.byteLength > REQUEST_IMAGE_MAX_BYTES) {
      throw new RequestError("REQUEST_IMAGE_TOO_LARGE", "Request image must be 5 MiB or smaller");
    }
    if (!this.storage || !this.mediaStorageScope) {
      throw new RequestError(
        "REQUEST_IMAGE_STORAGE_NOT_CONFIGURED",
        "Request image storage is not configured",
      );
    }

    const typedContentType = contentType as RequestImageContentType;
    const processed = await this.processor.process(input.body, typedContentType);
    if (
      processed.profile !== PHOTO_STANDARD.id ||
      processed.selectedVariants?.length !== 1 ||
      processed.selectedVariants[0] !== "master" ||
      processed.variants.length !== 1 ||
      processed.variants[0]?.variant !== "master"
    ) {
      throw new RequestError("REQUEST_IMAGE_UPLOAD_FAILED", "Request image upload failed");
    }
    const mediaId = randomUUID();
    const identity = {
      scope: this.mediaStorageScope,
      namespace: "REQUEST_PHOTO" as const,
      ownerId: requestId,
      mediaId,
    };
    const [plannedObject] = planMediaObjectKeys({
      ...identity,
      profile: PHOTO_STANDARD,
      requestedVariants: ["master"],
    });
    if (!plannedObject) {
      throw new RequestError("REQUEST_IMAGE_UPLOAD_FAILED", "Request image upload failed");
    }
    const requestedObjectKey = plannedObject.objectKey;
    await this.images.prepareUpload(mediaId, requestId, requestedObjectKey);

    try {
      const written = await writeMediaVariants({
        storage: this.storage,
        identity,
        processed,
      });
      const master = written.descriptors.find(({ variant }) => variant === "master");
      if (!master || master.objectKey !== requestedObjectKey) {
        throw new RequestError("REQUEST_IMAGE_UPLOAD_FAILED", "Request image upload failed");
      }
      const image = await this.images.replacePreparedUpload({
        mediaId,
        requestId,
        objectKey: master.objectKey,
        contentType: master.contentType,
        sizeBytes: master.sizeBytes,
      });
      return publicImage(image);
    } catch (error) {
      if (error instanceof RequestError) throw error;
      throw new RequestError("REQUEST_IMAGE_UPLOAD_FAILED", "Request image upload failed");
    }
  }

  async replaceExternalUrl(
    userId: string,
    requestId: string,
    input: HelpRequestExternalImageInput,
  ): Promise<HelpRequestImage> {
    await requireManageRequest(this.requests, this.visibility, userId, requestId);
    const parsed = helpRequestExternalImageInputSchema.parse(input);
    return publicImage(await this.images.replaceExternalUrl(requestId, parsed.url));
  }

  async delete(userId: string, requestId: string): Promise<void> {
    await requireManageRequest(this.requests, this.visibility, userId, requestId);
    const deleted = await this.images.deleteForRequest(requestId);
    if (!deleted) {
      throw new RequestError("REQUEST_IMAGE_NOT_FOUND", "Request image not found");
    }
  }

  async deliveryPublic(requestId: string): Promise<HelpRequestImageDelivery> {
    const request = await this.requests.getPublic(requestId);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return this.delivery(requestId);
  }

  async deliveryForMember(userId: string, requestId: string): Promise<HelpRequestImageDelivery> {
    const request = await this.requests.getVisibleToMember(userId, requestId);
    if (!request) throw new RequestError("REQUEST_NOT_FOUND", "Request not found");
    return this.delivery(requestId);
  }

  private async delivery(requestId: string): Promise<HelpRequestImageDelivery> {
    const image = await this.images.getForRequest(requestId);
    if (!image) throw new RequestError("REQUEST_IMAGE_NOT_FOUND", "Request image not found");

    if (image.source === "EXTERNAL_URL") {
      if (!image.externalUrl) {
        throw new RequestError("REQUEST_IMAGE_UNAVAILABLE", "Request image is unavailable");
      }
      return { contentUrl: image.externalUrl, expiresAt: null };
    }

    if (!image.objectKey || !this.storage || !supportsReadUrlSigning(this.storage)) {
      throw new RequestError(
        "REQUEST_IMAGE_STORAGE_NOT_CONFIGURED",
        "Request image storage is not configured",
      );
    }

    const issuedAt = Date.now();
    try {
      return {
        contentUrl: await this.storage.createReadUrl(
          image.objectKey,
          REQUEST_IMAGE_READ_URL_TTL_SECONDS,
        ),
        expiresAt: new Date(issuedAt + REQUEST_IMAGE_READ_URL_TTL_SECONDS * 1000).toISOString(),
      };
    } catch {
      throw new RequestError("REQUEST_IMAGE_UNAVAILABLE", "Request image is unavailable");
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

function publicImage(image: HelpRequestImageRecord): HelpRequestImage {
  return {
    id: image.id,
    source: image.source,
    contentType: image.contentType,
    sizeBytes: image.sizeBytes,
    updatedAt: image.updatedAt.toISOString(),
  };
}
