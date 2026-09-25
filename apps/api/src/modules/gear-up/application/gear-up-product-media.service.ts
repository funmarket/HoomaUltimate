import { randomUUID } from "node:crypto";
import {
  GEAR_UP_PRODUCT_IMAGE_CONTENT_TYPES,
  GEAR_UP_PRODUCT_IMAGE_MAX_BYTES,
  gearUpProductExternalImageInputSchema,
  gearUpProductImageOrderSchema,
  type GearUpProductExternalImageInput,
  type GearUpProductImage,
  type GearUpProductImageContentType,
  type GearUpProductImageDelivery,
  type GearUpProductImageOrderInput,
} from "@hooma/contracts/gear-up";
import type { ObjectStorage, ObjectStorageReadUrlSigner } from "@hooma/storage";
import type { PlatformAdminAccessPort } from "../../../application/platform-admin-access.port.js";
import type { PlaceRepository } from "../../places/application/place.repository.js";
import { GearUpError } from "../domain/gear-up-error.js";
import type { GearUpProductRepository } from "./gear-up-product.repository.js";
import type { GearUpProductImageProcessor } from "./gear-up-product-image-processor.js";
import type {
  GearUpProductImageRecord,
  GearUpProductMediaRepository,
} from "./gear-up-product-media.repository.js";

const IMAGE_READ_URL_TTL_SECONDS = 5 * 60;
const IMAGE_TYPES = new Set<string>(GEAR_UP_PRODUCT_IMAGE_CONTENT_TYPES);

export interface GearUpProductImageUploadInput {
  readonly contentType: string;
  readonly body: Uint8Array;
}

export class GearUpProductMediaService {
  constructor(
    private readonly images: GearUpProductMediaRepository,
    private readonly products: GearUpProductRepository,
    private readonly places: PlaceRepository,
    private readonly platformAdmin: PlatformAdminAccessPort,
    private readonly storage: ObjectStorage | null,
    private readonly processor: GearUpProductImageProcessor,
  ) {}

  async listPublic(productId: string): Promise<readonly GearUpProductImage[]> {
    if (!(await this.products.getPublic(productId))) {
      throw new GearUpError("GEAR_UP_PRODUCT_NOT_FOUND", "Gear Up product not found");
    }
    return (await this.images.list(productId)).map(publicImage);
  }

  async listManaged(
    userId: string,
    placeId: string,
    productId: string,
  ): Promise<readonly GearUpProductImage[]> {
    await this.requireManage(userId, placeId, productId);
    return (await this.images.list(productId)).map(publicImage);
  }

  async addExternalUrl(
    userId: string,
    placeId: string,
    productId: string,
    input: GearUpProductExternalImageInput,
  ): Promise<GearUpProductImage> {
    await this.requireManage(userId, placeId, productId);
    const parsed = gearUpProductExternalImageInputSchema.parse(input);
    return publicImage(await this.images.addExternalUrl(productId, parsed.url));
  }

  async addUpload(
    userId: string,
    placeId: string,
    productId: string,
    input: GearUpProductImageUploadInput,
  ): Promise<GearUpProductImage> {
    await this.requireManage(userId, placeId, productId);
    const contentType = normalizeContentType(input.contentType);
    if (!IMAGE_TYPES.has(contentType)) {
      throw new GearUpError(
        "GEAR_UP_PRODUCT_IMAGE_TYPE_INVALID",
        "Product image must be JPEG, PNG, or WebP",
      );
    }
    if (!input.body.byteLength) {
      throw new GearUpError(
        "GEAR_UP_PRODUCT_IMAGE_REQUIRED",
        "Product image bytes are required",
      );
    }
    if (input.body.byteLength > GEAR_UP_PRODUCT_IMAGE_MAX_BYTES) {
      throw new GearUpError(
        "GEAR_UP_PRODUCT_IMAGE_TOO_LARGE",
        "Product image must be 5 MiB or smaller",
      );
    }
    if (!this.storage) {
      throw new GearUpError(
        "GEAR_UP_PRODUCT_IMAGE_STORAGE_NOT_CONFIGURED",
        "Product image storage is not configured",
      );
    }

    const typedContentType = contentType as GearUpProductImageContentType;
    const processed = await this.processor.process(input.body, typedContentType);
    const imageId = randomUUID();
    const requestedObjectKey = productImageObjectKey(productId, imageId);
    await this.images.prepareUpload(imageId, productId, requestedObjectKey);

    let uploadedObjectKey: string | null = null;
    try {
      const stored = await this.storage.put(
        requestedObjectKey,
        processed.body,
        processed.contentType,
      );
      uploadedObjectKey = stored.key;
      if (!stored.key.startsWith(`gear-up-product-images/${productId}/`)) {
        throw new GearUpError(
          "GEAR_UP_PRODUCT_IMAGE_UPLOAD_FAILED",
          "Product image storage returned an invalid object key",
        );
      }
      if (stored.key !== requestedObjectKey) {
        await this.images.prepareUpload(imageId, productId, stored.key);
      }
      const image = await this.images.addPreparedUpload({
        imageId,
        productId,
        objectKey: stored.key,
        contentType: processed.contentType,
        sizeBytes: stored.sizeBytes,
      });
      uploadedObjectKey = null;
      return publicImage(image);
    } catch (error) {
      if (uploadedObjectKey) {
        try {
          await this.storage.remove(uploadedObjectKey);
        } catch (cleanupError) {
          throw new AggregateError(
            [error, cleanupError],
            "Gear Up product image persistence failed and object cleanup also failed",
          );
        }
      }
      if (error instanceof GearUpError) throw error;
      throw new GearUpError(
        "GEAR_UP_PRODUCT_IMAGE_UPLOAD_FAILED",
        "Product image upload failed",
      );
    }
  }

  async delete(
    userId: string,
    placeId: string,
    productId: string,
    imageId: string,
  ): Promise<void> {
    await this.requireManage(userId, placeId, productId);
    if (!(await this.images.delete(productId, imageId))) {
      throw new GearUpError("GEAR_UP_PRODUCT_IMAGE_NOT_FOUND", "Product image not found");
    }
  }

  async reorder(
    userId: string,
    placeId: string,
    productId: string,
    input: GearUpProductImageOrderInput,
  ): Promise<readonly GearUpProductImage[]> {
    await this.requireManage(userId, placeId, productId);
    const parsed = gearUpProductImageOrderSchema.parse(input);
    return (await this.images.reorder(productId, parsed.imageIds)).map(publicImage);
  }

  async deliveryPublic(
    productId: string,
    imageId: string,
  ): Promise<GearUpProductImageDelivery> {
    if (!(await this.products.getPublic(productId))) {
      throw new GearUpError("GEAR_UP_PRODUCT_NOT_FOUND", "Gear Up product not found");
    }
    return this.delivery(productId, imageId);
  }

  async deliveryManaged(
    userId: string,
    placeId: string,
    productId: string,
    imageId: string,
  ): Promise<GearUpProductImageDelivery> {
    await this.requireManage(userId, placeId, productId);
    return this.delivery(productId, imageId);
  }

  private async delivery(
    productId: string,
    imageId: string,
  ): Promise<GearUpProductImageDelivery> {
    const image = await this.images.get(productId, imageId);
    if (!image) {
      throw new GearUpError("GEAR_UP_PRODUCT_IMAGE_NOT_FOUND", "Product image not found");
    }
    if (image.source === "EXTERNAL_URL") {
      if (!image.externalUrl) {
        throw new GearUpError(
          "GEAR_UP_PRODUCT_IMAGE_UNAVAILABLE",
          "Product image is unavailable",
        );
      }
      return { contentUrl: image.externalUrl, expiresAt: null };
    }
    if (!image.objectKey || !this.storage || !supportsReadUrlSigning(this.storage)) {
      throw new GearUpError(
        "GEAR_UP_PRODUCT_IMAGE_STORAGE_NOT_CONFIGURED",
        "Product image storage is not configured",
      );
    }
    const issuedAt = Date.now();
    try {
      return {
        contentUrl: await this.storage.createReadUrl(
          image.objectKey,
          IMAGE_READ_URL_TTL_SECONDS,
        ),
        expiresAt: new Date(issuedAt + IMAGE_READ_URL_TTL_SECONDS * 1000).toISOString(),
      };
    } catch {
      throw new GearUpError(
        "GEAR_UP_PRODUCT_IMAGE_UNAVAILABLE",
        "Product image is unavailable",
      );
    }
  }

  private async requireManage(
    userId: string,
    placeId: string,
    productId: string,
  ): Promise<void> {
    if (
      !(await this.places.hasVerifiedOwnership(placeId, userId)) &&
      !(await this.platformAdmin.isPlatformAdmin(userId))
    ) {
      throw new GearUpError(
        "GEAR_UP_PRODUCT_MEDIA_MANAGE_FORBIDDEN",
        "Verified Place owner or App Admin access required",
      );
    }
    const product = await this.products.getManaged(productId);
    if (!product || product.shopPlaceId !== placeId) {
      throw new GearUpError("GEAR_UP_PRODUCT_NOT_FOUND", "Gear Up product not found");
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

function productImageObjectKey(productId: string, imageId: string): string {
  return `gear-up-product-images/${productId}/${imageId}`;
}

function publicImage(image: GearUpProductImageRecord): GearUpProductImage {
  return {
    id: image.id,
    source: image.source,
    contentType: image.contentType,
    sizeBytes: image.sizeBytes,
    sortOrder: image.sortOrder,
    updatedAt: image.updatedAt.toISOString(),
  };
}
