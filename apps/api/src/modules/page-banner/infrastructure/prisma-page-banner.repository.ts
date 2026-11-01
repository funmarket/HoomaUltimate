import {
  PAGE_BANNER_CLEANUP_TOPIC,
  PAGE_BANNER_RECONCILE_TOPIC,
  type PageBannerPlacementId,
  type PageBannerSlideMetadata,
} from "@hooma/contracts/page-banner";
import { Prisma, type PrismaClient } from "@hooma/database";
import type { AuditWriter } from "../../audit/application/audit-writer.js";
import type {
  PageBannerPlacementRecord,
  PageBannerRepository,
  PageBannerSlideRecord,
  PageBannerVariantRecord,
} from "../application/page-banner.repository.js";

const placementSelect = Prisma.validator<Prisma.PageBannerPlacementSelect>()({
  id: true,
  enabled: true,
  slides: {
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { variants: { orderBy: { variant: "asc" } } },
  },
});

function record(
  row: Prisma.PageBannerPlacementGetPayload<{ select: typeof placementSelect }>,
): PageBannerPlacementRecord {
  return {
    id: row.id as PageBannerPlacementId,
    enabled: row.enabled,
    slides: row.slides.map((slide) => ({
      id: slide.id,
      placementId: slide.placementId as PageBannerPlacementId,
      mediaId: slide.mediaId,
      sortOrder: slide.sortOrder,
      enabled: slide.enabled,
      isDecorative: slide.isDecorative,
      altText: slide.altText,
      destinationKind: slide.destinationKind,
      destinationUrl: slide.destinationUrl,
      variants: slide.variants.map((variant) => ({
        variant: variant.variant,
        objectKey: variant.objectKey,
        contentType: variant.contentType,
        sizeBytes: variant.sizeBytes,
        widthPx: variant.widthPx,
        heightPx: variant.heightPx,
      })),
    })),
  };
}

function slideRecord(
  row: Prisma.PageBannerSlideGetPayload<{ include: { variants: true } }>,
): PageBannerSlideRecord {
  return {
    id: row.id,
    placementId: row.placementId as PageBannerPlacementId,
    mediaId: row.mediaId,
    sortOrder: row.sortOrder,
    enabled: row.enabled,
    isDecorative: row.isDecorative,
    altText: row.altText,
    destinationKind: row.destinationKind,
    destinationUrl: row.destinationUrl,
    variants: row.variants.map((variant) => ({
      variant: variant.variant,
      objectKey: variant.objectKey,
      contentType: variant.contentType,
      sizeBytes: variant.sizeBytes,
      widthPx: variant.widthPx,
      heightPx: variant.heightPx,
    })),
  };
}

function metadataData(metadata: PageBannerSlideMetadata) {
  return {
    enabled: metadata.enabled ?? true,
    isDecorative: metadata.isDecorative,
    altText: metadata.altText ?? null,
    destinationKind: metadata.destination?.kind ?? null,
    destinationUrl: metadata.destination?.url ?? null,
  };
}

export class PrismaPageBannerRepository implements PageBannerRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly auditWriter: AuditWriter,
  ) {}

  async list(): Promise<readonly PageBannerPlacementRecord[]> {
    const rows = await this.db.pageBannerPlacement.findMany({
      select: placementSelect,
      orderBy: { id: "asc" },
    });
    return rows.map(record);
  }

  async get(placementId: PageBannerPlacementId): Promise<PageBannerPlacementRecord | null> {
    const row = await this.db.pageBannerPlacement.findUnique({
      where: { id: placementId },
      select: placementSelect,
    });
    return row ? record(row) : null;
  }

  async setEnabled(
    actorUserId: string,
    placementId: PageBannerPlacementId,
    enabled: boolean,
  ): Promise<PageBannerPlacementRecord | null> {
    return this.db.$transaction(async (tx) => {
      const exists = await tx.pageBannerPlacement.updateMany({
        where: { id: placementId },
        data: { enabled },
      });
      if (!exists.count) return null;
      await this.auditWriter.writeInTransaction(
        {
          actorUserId,
          action: enabled ? "PAGE_BANNER_PLACEMENT_ENABLED" : "PAGE_BANNER_PLACEMENT_DISABLED",
          entityType: "PageBannerPlacement",
          entityId: placementId,
          metadata: { placementId, enabled },
        },
        tx,
      );
      const row = await tx.pageBannerPlacement.findUnique({
        where: { id: placementId },
        select: placementSelect,
      });
      return row ? record(row) : null;
    });
  }

  async prepareUpload(input: {
    readonly mediaId: string;
    readonly placementId: PageBannerPlacementId;
    readonly objectKeys: readonly string[];
  }): Promise<void> {
    await this.db.outboxEvent.upsert({
      where: { id: input.mediaId },
      create: {
        id: input.mediaId,
        topic: PAGE_BANNER_RECONCILE_TOPIC,
        aggregateType: "PageBannerSlide",
        aggregateId: input.placementId,
        payload: {
          placementId: input.placementId,
          mediaId: input.mediaId,
          objectKeys: [...input.objectKeys],
        },
        availableAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      update: {
        payload: {
          placementId: input.placementId,
          mediaId: input.mediaId,
          objectKeys: [...input.objectKeys],
        },
      },
    });
  }

  async addPreparedSlide(input: {
    actorUserId: string;
    placementId: PageBannerPlacementId;
    mediaId: string;
    variants: readonly PageBannerVariantRecord[];
    metadata: PageBannerSlideMetadata;
  }): Promise<PageBannerSlideRecord> {
    return this.db.$transaction(async (tx) => {
      await lockPlacement(tx, input.placementId);
      const count = await tx.pageBannerSlide.count({ where: { placementId: input.placementId } });
      if (count >= 3) throw new Error("PAGE_BANNER_LIMIT_REACHED");
      await consumeIntent(tx, input.mediaId, input.placementId);
      const slide = await tx.pageBannerSlide.create({
        data: {
          placementId: input.placementId,
          mediaId: input.mediaId,
          sortOrder: count,
          ...metadataData(input.metadata),
          variants: {
            create: input.variants.map((variant) => ({
              variant: variant.variant,
              objectKey: variant.objectKey,
              contentType: variant.contentType,
              sizeBytes: variant.sizeBytes,
              widthPx: variant.widthPx,
              heightPx: variant.heightPx,
            })),
          },
        },
        include: { variants: true },
      });
      await this.auditWriter.writeInTransaction(
        {
          actorUserId: input.actorUserId,
          action: "PAGE_BANNER_SLIDE_CREATED",
          entityType: "PageBannerSlide",
          entityId: slide.id,
          metadata: { placementId: input.placementId, mediaId: input.mediaId },
        },
        tx,
      );
      return slideRecord(slide);
    });
  }

  async replacePreparedSlide(input: {
    actorUserId: string;
    placementId: PageBannerPlacementId;
    slideId: string;
    mediaId: string;
    variants: readonly PageBannerVariantRecord[];
    metadata: PageBannerSlideMetadata;
  }): Promise<PageBannerSlideRecord | null> {
    return this.db.$transaction(async (tx) => {
      await lockPlacement(tx, input.placementId);
      const previous = await tx.pageBannerSlide.findFirst({
        where: { id: input.slideId, placementId: input.placementId },
        include: { variants: true },
      });
      if (!previous) return null;
      await consumeIntent(tx, input.mediaId, input.placementId);
      await tx.pageBannerSlideVariant.deleteMany({ where: { slideId: previous.id } });
      const next = await tx.pageBannerSlide.update({
        where: { id: previous.id },
        data: {
          mediaId: input.mediaId,
          ...metadataData(input.metadata),
          variants: {
            create: input.variants.map((variant) => ({
              variant: variant.variant,
              objectKey: variant.objectKey,
              contentType: variant.contentType,
              sizeBytes: variant.sizeBytes,
              widthPx: variant.widthPx,
              heightPx: variant.heightPx,
            })),
          },
        },
        include: { variants: true },
      });
      await createCleanup(
        tx,
        input.placementId,
        previous.id,
        previous.mediaId,
        previous.variants.map(({ objectKey }) => objectKey),
      );
      await this.auditWriter.writeInTransaction(
        {
          actorUserId: input.actorUserId,
          action: "PAGE_BANNER_SLIDE_REPLACED",
          entityType: "PageBannerSlide",
          entityId: previous.id,
          metadata: {
            placementId: input.placementId,
            previousMediaId: previous.mediaId,
            mediaId: input.mediaId,
          },
        },
        tx,
      );
      return slideRecord(next);
    });
  }

  async updateSlide(
    actorUserId: string,
    placementId: PageBannerPlacementId,
    slideId: string,
    metadata: PageBannerSlideMetadata,
  ): Promise<PageBannerSlideRecord | null> {
    return this.db.$transaction(async (tx) => {
      const row = await tx.pageBannerSlide.updateMany({
        where: { id: slideId, placementId },
        data: metadataData(metadata),
      });
      if (!row.count) return null;
      const slide = await tx.pageBannerSlide.findUniqueOrThrow({
        where: { id: slideId },
        include: { variants: true },
      });
      await this.auditWriter.writeInTransaction(
        {
          actorUserId,
          action: "PAGE_BANNER_SLIDE_UPDATED",
          entityType: "PageBannerSlide",
          entityId: slideId,
          metadata: { placementId },
        },
        tx,
      );
      return slideRecord(slide);
    });
  }

  async reorder(
    actorUserId: string,
    placementId: PageBannerPlacementId,
    slideIds: readonly string[],
  ): Promise<readonly PageBannerSlideRecord[] | null> {
    return this.db.$transaction(async (tx) => {
      await lockPlacement(tx, placementId);
      const existing = await tx.pageBannerSlide.findMany({
        where: { placementId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      const expected = new Set(existing.map(({ id }) => id));
      if (
        slideIds.length !== existing.length ||
        new Set(slideIds).size !== slideIds.length ||
        slideIds.some((id) => !expected.has(id))
      )
        throw new Error("PAGE_BANNER_ORDER_INVALID");
      for (const [index, id] of slideIds.entries())
        await tx.pageBannerSlide.update({ where: { id }, data: { sortOrder: 1000 + index } });
      for (const [index, id] of slideIds.entries())
        await tx.pageBannerSlide.update({ where: { id }, data: { sortOrder: index } });
      const rows = await tx.pageBannerSlide.findMany({
        where: { placementId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: { variants: true },
      });
      await this.auditWriter.writeInTransaction(
        {
          actorUserId,
          action: "PAGE_BANNER_SLIDE_REORDERED",
          entityType: "PageBannerPlacement",
          entityId: placementId,
          metadata: { placementId, slideIds: [...slideIds] },
        },
        tx,
      );
      return rows.map(slideRecord);
    });
  }

  async deleteSlide(
    actorUserId: string,
    placementId: PageBannerPlacementId,
    slideId: string,
  ): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      await lockPlacement(tx, placementId);
      const slide = await tx.pageBannerSlide.findFirst({
        where: { id: slideId, placementId },
        include: { variants: true },
      });
      if (!slide) return false;
      await tx.pageBannerSlide.delete({ where: { id: slideId } });
      await createCleanup(
        tx,
        placementId,
        slide.id,
        slide.mediaId,
        slide.variants.map(({ objectKey }) => objectKey),
      );
      await this.auditWriter.writeInTransaction(
        {
          actorUserId,
          action: "PAGE_BANNER_SLIDE_DELETED",
          entityType: "PageBannerSlide",
          entityId: slideId,
          metadata: { placementId, mediaId: slide.mediaId },
        },
        tx,
      );
      const remaining = await tx.pageBannerSlide.findMany({
        where: { placementId },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      for (const [index, row] of remaining.entries())
        await tx.pageBannerSlide.update({
          where: { id: row.id },
          data: { sortOrder: 1000 + index },
        });
      for (const [index, row] of remaining.entries())
        await tx.pageBannerSlide.update({ where: { id: row.id }, data: { sortOrder: index } });
      return true;
    });
  }
}

async function lockPlacement(tx: Prisma.TransactionClient, placementId: string): Promise<void> {
  await tx.$queryRaw(
    Prisma.sql`SELECT "id" FROM "PageBannerPlacement" WHERE "id" = ${placementId} FOR UPDATE`,
  );
}

async function consumeIntent(
  tx: Prisma.TransactionClient,
  mediaId: string,
  placementId: string,
): Promise<void> {
  const result = await tx.outboxEvent.deleteMany({
    where: {
      id: mediaId,
      topic: PAGE_BANNER_RECONCILE_TOPIC,
      aggregateId: placementId,
      status: "PENDING",
    },
  });
  if (result.count !== 1) throw new Error("PAGE_BANNER_UPLOAD_EXPIRED");
}

async function createCleanup(
  tx: Prisma.TransactionClient,
  placementId: string,
  slideId: string,
  mediaId: string,
  objectKeys: readonly string[],
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      id: `page-banner-cleanup:${mediaId}`,
      topic: PAGE_BANNER_CLEANUP_TOPIC,
      aggregateType: "PageBannerSlide",
      aggregateId: placementId,
      payload: { placementId, slideId, mediaId, objectKeys },
    },
  });
}
