import type { PrismaClient } from "@hooma/database";
import type {
  AthletesDashboardPhotoRecord,
  AthletesDashboardPhotoRepository,
} from "../application/athletes-dashboard-photo.repository.js";

export class PrismaAthletesDashboardPhotoRepository implements AthletesDashboardPhotoRepository {
  constructor(private readonly db: PrismaClient) {}

  create(input: {
    readonly id: string;
    readonly athletesCommunityId: string;
    readonly authorUserId: string;
    readonly objectKey: string;
    readonly contentType: string;
    readonly sizeBytes: number;
  }): Promise<AthletesDashboardPhotoRecord> {
    return this.db.athletesDashboardPhoto.create({ data: input });
  }

  list(athletesCommunityId: string, limit: number): Promise<AthletesDashboardPhotoRecord[]> {
    return this.db.athletesDashboardPhoto.findMany({
      where: { athletesCommunityId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
  }

  get(athletesCommunityId: string, photoId: string): Promise<AthletesDashboardPhotoRecord | null> {
    return this.db.athletesDashboardPhoto.findFirst({
      where: { id: photoId, athletesCommunityId },
    });
  }
}
