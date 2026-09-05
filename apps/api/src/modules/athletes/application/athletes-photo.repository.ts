export interface AthletesPhotoRecord {
  readonly id: string;
  readonly athletesCommunityId: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedByUserId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AthletesPhotoCreateInput {
  readonly id: string;
  readonly athletesCommunityId: string;
  readonly objectKey: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedByUserId: string;
}

export interface AthletesPhotoRepository {
  create(input: AthletesPhotoCreateInput): Promise<AthletesPhotoRecord>;
  listForCommunity(athletesCommunityId: string): Promise<AthletesPhotoRecord[]>;
  getForCommunity(
    athletesCommunityId: string,
    photoId: string,
  ): Promise<AthletesPhotoRecord | null>;
}
