export interface AthletesDashboardPhotoRecord {
  readonly id: string;
  readonly athletesCommunityId: string;
  readonly authorUserId: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly createdAt: Date;
}

export interface AthletesDashboardPhotoRepository {
  create(input: {
    readonly id: string;
    readonly athletesCommunityId: string;
    readonly authorUserId: string;
    readonly objectKey: string;
    readonly contentType: string;
    readonly sizeBytes: number;
  }): Promise<AthletesDashboardPhotoRecord>;
  list(athletesCommunityId: string, limit: number): Promise<AthletesDashboardPhotoRecord[]>;
  get(
    athletesCommunityId: string,
    photoId: string,
  ): Promise<AthletesDashboardPhotoRecord | null>;
}
