import {
  GEAR_UP_PRODUCT_IMAGE_RECONCILE_TOPIC,
  type GearUpProductImageContentType,
  type GearUpProductImageSource,
  type GearUpSettingsUpdateInput,
} from "@hooma/contracts/gear-up";
import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  GearUpProductImageRecord,
  GearUpProductMediaRepository,
  GearUpSettingsRecord,
} from "../application/gear-up-product-media.repository.js";
import { GearUpError } from "../domain/gear-up-error.js";

const imageSelect = Prisma.validator<Prisma.GearUpProductImageSelect>()({
  id: true,
  productId: true,
  source: true,
  objectKey: true,
  externalUrl: true,
  contentType: true,
  sizeBytes: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
});

type ImageRow = Prisma.GearUpProductImageGetPayload<{ select: typeof imageSelect }>;

export class PrismaGearUpProductMediaRepository implements GearUpProductMediaRepository {
  constructor(private readonly db: PrismaClient) {}

  async list(productId: string): Promise<readonly GearUpProductImageRecord[]> {
    const rows = await this.db.gearUpProductImage.findMany({
      where: { productId },
      select: imageSelect,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
    return rows.map(record);
  }

  async get(productId: string, imageId: string): Promise<GearUpProductImageRecord | null> {
    const row = await this.db.gearUpProductImage.findFirst({
      where: { id: imageId, productId },
      select: imageSelect,
    });
    return row ? record(row) : null;
  }

  async getSettings(): Promise<GearUpSettingsRecord> {
    const settings = await this.db.gearUpSettings.upsert({
      where: { id: "default" },
      create: { id: "default", productImageLimit: 3 },
      update: {},
      select: { productImageLimit: true },
    });
    return settings;
  }

  async updateSettings(
    userId: string,
    input: GearUpSettingsUpdateInput,
  ): Promise<GearUpSettingsRecord> {
    return this.db.gearUpSettings.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        productImageLimit: input.productImageLimit,
        updatedByUserId: userId,
      },
      update: {
        productImageLimit: input.productImageLimit,
        updatedByUserId: userId,
      },
      select: { productImageLimit: true },
    });
  }

  async addExternalUrl(productId: string, url: string): Promise<GearUpProductImageRecord> {
    return this.db.$transaction(async (tx) => {
      const sortOrder = await nextImageSlot(tx, productId);
      const row = await tx.gearUpProductImage.create({
        data: {
          productId,
          source: "EXTERNAL_URL",
          externalUrl: url,
          objectKey: null,
          contentType: null,
          sizeBytes: null,
          sortOrder,
        },
        select: imageSelect,
      });
      return record(row);
    });
  }

  async prepareUpload(imageId: string, productId: string, objectKey: string): Promise<void> {
    await this.db.outboxEvent.upsert({
      where: { id: imageId },
      create: {
        id: imageId,
        topic: GEAR_UP_PRODUCT_IMAGE_RECONCILE_TOPIC,
        aggregateType: "GearUpProductImage",
        aggregateId: productId,
        payload: { productId, objectKey },
        availableAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      update: { payload: { productId, objectKey } },
    });
  }

  async addPreparedUpload(input: {
    readonly imageId: string;
    readonly productId: string;
    readonly objectKey: string;
    readonly contentType: GearUpProductImageContentType;
    readonly sizeBytes: number;
  }): Promise<GearUpProductImageRecord> {
    return this.db.$transaction(async (tx) => {
      const intent = await tx.outboxEvent.deleteMany({
        where: {
          id: input.imageId,
          topic: GEAR_UP_PRODUCT_IMAGE_RECONCILE_TOPIC,
          status: "PENDING",
        },
      });
      if (intent.count !== 1) {
        throw new GearUpError(
          "GEAR_UP_PRODUCT_IMAGE_UPLOAD_FAILED",
          "Product image upload expired; retry",
        );
      }

      const sortOrder = await nextImageSlot(tx, input.productId);
      const row = await tx.gearUpProductImage.create({
        data: {
          id: input.imageId,
          productId: input.productId,
          source: "UPLOAD",
          objectKey: input.objectKey,
          externalUrl: null,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          sortOrder,
        },
        select: imageSelect,
      });
      return record(row);
    });
  }

  async delete(productId: string, imageId: string): Promise<GearUpProductImageRecord | null> {
    return this.db.$transaction(async (tx) => {
      await lockProduct(tx, productId);
      const previous = await tx.gearUpProductImage.findFirst({
        where: { id: imageId, productId },
        select: imageSelect,
      });
      if (!previous) return null;

      await tx.gearUpProductImage.delete({ where: { id: imageId } });
      if (previous.objectKey) {
        await scheduleCleanup(tx, productId, previous.objectKey);
      }
      await compactImageOrder(tx, productId);
      return record(previous);
    });
  }

  async reorder(
    productId: string,
    imageIds: readonly string[],
  ): Promise<readonly GearUpProductImageRecord[]> {
    return this.db.$transaction(async (tx) => {
      await lockProduct(tx, productId);
      const current = await tx.gearUpProductImage.findMany({
        where: { productId },
        select: { id: true },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      const currentIds = new Set(current.map((image) => image.id));
      if (
        current.length !== imageIds.length ||
        imageIds.some((imageId) => !currentIds.has(imageId))
      ) {
        throw new GearUpError(
          "GEAR_UP_PRODUCT_IMAGE_ORDER_INVALID",
          "Product image order must include every current image exactly once",
        );
      }

      for (let index = 0; index < imageIds.length; index += 1) {
        await tx.gearUpProductImage.update({
          where: { id: imageIds[index]! },
          data: { sortOrder: -(index + 1) },
        });
      }
      for (let index = 0; index < imageIds.length; index += 1) {
        await tx.gearUpProductImage.update({
          where: { id: imageIds[index]! },
          data: { sortOrder: index },
        });
      }
      const rows = await tx.gearUpProductImage.findMany({
        where: { productId },
        select: imageSelect,
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      });
      return rows.map(record);
    });
  }
}

async function nextImageSlot(tx: Prisma.TransactionClient, productId: string): Promise<number> {
  await lockProduct(tx, productId);
  const [settings, count] = await Promise.all([
    tx.gearUpSettings.upsert({
      where: { id: "default" },
      create: { id: "default", productImageLimit: 3 },
      update: {},
      select: { productImageLimit: true },
    }),
    tx.gearUpProductImage.count({ where: { productId } }),
  ]);
  if (count >= settings.productImageLimit) {
    throw new GearUpError(
      "GEAR_UP_PRODUCT_IMAGE_LIMIT_REACHED",
      "This product has reached its configured image limit",
    );
  }
  return count;
}

async function lockProduct(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM "GearUpProduct" WHERE "id" = ${productId} FOR UPDATE`,
  );
  if (!rows.length) {
    throw new GearUpError("GEAR_UP_PRODUCT_NOT_FOUND", "Gear Up product not found");
  }
}

async function compactImageOrder(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  const rows = await tx.gearUpProductImage.findMany({
    where: { productId },
    select: { id: true, sortOrder: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
  for (let index = 0; index < rows.length; index += 1) {
    if (rows[index]!.sortOrder === index) continue;
    await tx.gearUpProductImage.update({
      where: { id: rows[index]!.id },
      data: { sortOrder: index },
    });
  }
}

async function scheduleCleanup(
  tx: Prisma.TransactionClient,
  productId: string,
  objectKey: string,
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      topic: GEAR_UP_PRODUCT_IMAGE_RECONCILE_TOPIC,
      aggregateType: "GearUpProductImage",
      aggregateId: productId,
      payload: { productId, objectKey },
      availableAt: new Date(),
    },
  });
}

function record(row: ImageRow): GearUpProductImageRecord {
  return {
    ...row,
    source: row.source as GearUpProductImageSource,
    contentType: row.contentType as GearUpProductImageContentType | null,
  };
}
