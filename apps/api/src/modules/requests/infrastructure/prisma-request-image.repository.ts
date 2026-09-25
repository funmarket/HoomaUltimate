import {
  REQUEST_IMAGE_RECONCILE_TOPIC,
  type HelpRequestImageSource,
  type RequestImageContentType,
} from "@hooma/contracts/requests";
import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  HelpRequestImageRecord,
  RequestImageRepository,
} from "../application/request-image.repository.js";
import { RequestError } from "../domain/request-error.js";

const requestImageSelect = Prisma.validator<Prisma.HelpRequestImageSelect>()({
  id: true,
  requestId: true,
  source: true,
  objectKey: true,
  externalUrl: true,
  contentType: true,
  sizeBytes: true,
  createdAt: true,
  updatedAt: true,
});

type RequestImageRow = Prisma.HelpRequestImageGetPayload<{
  select: typeof requestImageSelect;
}>;

export class PrismaRequestImageRepository implements RequestImageRepository {
  constructor(private readonly db: PrismaClient) {}

  async prepareUpload(mediaId: string, requestId: string, objectKey: string): Promise<void> {
    await this.db.outboxEvent.upsert({
      where: { id: mediaId },
      create: {
        id: mediaId,
        topic: REQUEST_IMAGE_RECONCILE_TOPIC,
        aggregateType: "HelpRequestImage",
        aggregateId: requestId,
        payload: { requestId, objectKey },
        availableAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      update: { payload: { requestId, objectKey } },
    });
  }

  async replacePreparedUpload(input: {
    readonly mediaId: string;
    readonly requestId: string;
    readonly objectKey: string;
    readonly contentType: RequestImageContentType;
    readonly sizeBytes: number;
  }): Promise<HelpRequestImageRecord> {
    return this.db.$transaction(async (tx) => {
      const intent = await tx.outboxEvent.deleteMany({
        where: { id: input.mediaId, topic: REQUEST_IMAGE_RECONCILE_TOPIC, status: "PENDING" },
      });
      if (intent.count !== 1) {
        throw new RequestError(
          "REQUEST_IMAGE_UPLOAD_FAILED",
          "Request image upload expired; retry",
        );
      }

      const previous = await tx.helpRequestImage.findUnique({
        where: { requestId: input.requestId },
        select: requestImageSelect,
      });
      const current = await tx.helpRequestImage.upsert({
        where: { requestId: input.requestId },
        create: {
          requestId: input.requestId,
          source: "UPLOAD",
          objectKey: input.objectKey,
          externalUrl: null,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
        },
        update: {
          source: "UPLOAD",
          objectKey: input.objectKey,
          externalUrl: null,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
        },
        select: requestImageSelect,
      });

      if (previous?.objectKey && previous.objectKey !== current.objectKey) {
        await scheduleCleanup(tx, input.requestId, previous.objectKey);
      }
      return record(current);
    });
  }

  async replaceExternalUrl(requestId: string, url: string): Promise<HelpRequestImageRecord> {
    return this.db.$transaction(async (tx) => {
      const previous = await tx.helpRequestImage.findUnique({
        where: { requestId },
        select: requestImageSelect,
      });
      const current = await tx.helpRequestImage.upsert({
        where: { requestId },
        create: {
          requestId,
          source: "EXTERNAL_URL",
          objectKey: null,
          externalUrl: url,
          contentType: null,
          sizeBytes: null,
        },
        update: {
          source: "EXTERNAL_URL",
          objectKey: null,
          externalUrl: url,
          contentType: null,
          sizeBytes: null,
        },
        select: requestImageSelect,
      });

      if (previous?.objectKey) await scheduleCleanup(tx, requestId, previous.objectKey);
      return record(current);
    });
  }

  async getForRequest(requestId: string): Promise<HelpRequestImageRecord | null> {
    const row = await this.db.helpRequestImage.findUnique({
      where: { requestId },
      select: requestImageSelect,
    });
    return row ? record(row) : null;
  }

  async deleteForRequest(requestId: string): Promise<HelpRequestImageRecord | null> {
    return this.db.$transaction(async (tx) => {
      const previous = await tx.helpRequestImage.findUnique({
        where: { requestId },
        select: requestImageSelect,
      });
      if (!previous) return null;
      await tx.helpRequestImage.delete({ where: { requestId } });
      if (previous.objectKey) await scheduleCleanup(tx, requestId, previous.objectKey);
      return record(previous);
    });
  }
}

async function scheduleCleanup(
  tx: Prisma.TransactionClient,
  requestId: string,
  objectKey: string,
): Promise<void> {
  await tx.outboxEvent.create({
    data: {
      topic: REQUEST_IMAGE_RECONCILE_TOPIC,
      aggregateType: "HelpRequestImage",
      aggregateId: requestId,
      payload: { requestId, objectKey },
      availableAt: new Date(),
    },
  });
}

function record(row: RequestImageRow): HelpRequestImageRecord {
  return {
    ...row,
    source: row.source as HelpRequestImageSource,
    contentType: row.contentType as RequestImageContentType | null,
  };
}
