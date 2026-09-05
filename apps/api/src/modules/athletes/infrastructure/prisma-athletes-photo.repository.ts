import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  AthletesPhotoCreateInput,
  AthletesPhotoRecord,
  AthletesPhotoRepository,
} from "../application/athletes-photo.repository.js";

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

export class PrismaAthletesPhotoRepository implements AthletesPhotoRepository {
  constructor(private readonly db: PrismaClient) {}

  async create(input: AthletesPhotoCreateInput): Promise<AthletesPhotoRecord> {
    const row = await this.db.athletesPhoto.create({
      data: input,
      select: athletesPhotoSelect,
    });

    return serializeAthletesPhoto(row);
  }

  async listForCommunity(athletesCommunityId: string): Promise<AthletesPhotoRecord[]> {
    const rows = await this.db.athletesPhoto.findMany({
      where: { athletesCommunityId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
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
