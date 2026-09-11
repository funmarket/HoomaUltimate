import { ATHLETES_PHOTO_RECONCILE_TOPIC } from "@hooma/contracts/athletes";
import { Prisma, type PrismaClient } from "@hooma/database";
import { AthletesError } from "../domain/athletes-error.js";
import type {
  AthletesPhotoCreateInput,
  AthletesPhotoRecord,
  AthletesPhotoRepository,
} from "../application/athletes-photo.repository.js";
import type {
  AthletesPhotoTransactionRepository,
  AthletesPhotoTransactionScope,
  AthletesPhotoUnitOfWork,
} from "../application/athletes-photo.unit-of-work.js";
import { PrismaAthletesRepository } from "./prisma-athletes.repository.js";

const athletesPhotoSelect = Prisma.validator<Prisma.AthletesPhotoSelect>()({
  id: true,
  athletesCommunityId: true,
  objectKey: true,
  contentType: true,
  sizeBytes: true,
  uploadedByUserId: true,
  createdAt: true,
  updatedAt: true,
});

type AthletesPhotoRow = Prisma.AthletesPhotoGetPayload<{
  select: typeof athletesPhotoSelect;
}>;

class PrismaAthletesPhotoTransactionRepository implements AthletesPhotoTransactionRepository {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async createPrepared(input: AthletesPhotoCreateInput): Promise<AthletesPhotoRecord> {
    const intent = await this.tx.outboxEvent.deleteMany({
      where: { id: input.id, topic: ATHLETES_PHOTO_RECONCILE_TOPIC, status: "PENDING" },
    });
    if (intent.count !== 1) {
      throw new AthletesError(
        "ATHLETES_PHOTO_UPLOAD_FAILED",
        "Photo upload expired; please retry",
      );
    }
    const row = await this.tx.athletesPhoto.create({ data: input, select: athletesPhotoSelect });
    return serializeAthletesPhoto(row);
  }

  async deleteAndScheduleCleanup(athletesCommunityId: string, photoId: string): Promise<boolean> {
    const row = await this.tx.athletesPhoto.findFirst({
      where: { id: photoId, athletesCommunityId },
      select: athletesPhotoSelect,
    });
    if (!row) return false;

    await this.tx.athletesPhoto.delete({ where: { id: photoId } });
    await this.tx.outboxEvent.create({
      data: {
        id: photoId,
        topic: ATHLETES_PHOTO_RECONCILE_TOPIC,
        aggregateType: "AthletesPhoto",
        aggregateId: photoId,
        payload: { photoId, athletesCommunityId, objectKey: row.objectKey },
        availableAt: new Date(),
      },
    });
    return true;
  }
}

export class PrismaAthletesPhotoRepository
  implements AthletesPhotoRepository, AthletesPhotoUnitOfWork
{
  constructor(private readonly db: PrismaClient) {}

  async prepareUpload(
    photoId: string,
    athletesCommunityId: string,
    objectKey: string,
  ): Promise<void> {
    await this.db.outboxEvent.upsert({
      where: { id: photoId },
      create: {
        id: photoId,
        topic: ATHLETES_PHOTO_RECONCILE_TOPIC,
        aggregateType: "AthletesPhoto",
        aggregateId: photoId,
        payload: { photoId, athletesCommunityId, objectKey },
        availableAt: new Date(Date.now() + 60 * 60 * 1000),
      },
      update: { payload: { photoId, athletesCommunityId, objectKey } },
    });
  }

  withCommunityLock<T>(
    athletesCommunityId: string,
    operation: (scope: AthletesPhotoTransactionScope) => Promise<T>,
  ): Promise<T> {
    return this.db.$transaction(async (tx) => {
      const athletes = new PrismaAthletesRepository(tx);
      return athletes.withCommunityLock(athletesCommunityId, (lockedAthletes) =>
        operation({
          athletes: lockedAthletes,
          photos: new PrismaAthletesPhotoTransactionRepository(tx),
        }),
      );
    });
  }

  async listForCommunity(
    athletesCommunityId: string,
    page: { cursor?: string | undefined; limit: number } = { limit: 24 },
  ): Promise<AthletesPhotoRecord[]> {
    const rows = await this.db.athletesPhoto.findMany({
      where: { athletesCommunityId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: Math.min(Math.max(page.limit, 1), 50),
      ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
      select: athletesPhotoSelect,
    });

    return rows.map(serializeAthletesPhoto);
  }

  async getForCommunity(
    athletesCommunityId: string,
    photoId: string,
  ): Promise<AthletesPhotoRecord | null> {
    const row = await this.db.athletesPhoto.findFirst({
      where: { id: photoId, athletesCommunityId },
      select: athletesPhotoSelect,
    });

    return row ? serializeAthletesPhoto(row) : null;
  }
}

function serializeAthletesPhoto(row: AthletesPhotoRow): AthletesPhotoRecord {
  return {
    id: row.id,
    athletesCommunityId: row.athletesCommunityId,
    objectKey: row.objectKey,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    uploadedByUserId: row.uploadedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
