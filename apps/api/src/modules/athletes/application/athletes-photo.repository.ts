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
  prepareUpload(photoId: string, athletesCommunityId: string, objectKey: string): Promise<void>;
  listForCommunity(
    athletesCommunityId: string,
    page?: { cursor?: string | undefined; limit: number },
  ): Promise<AthletesPhotoRecord[]>;
  getForCommunity(
    athletesCommunityId: string,
    photoId: string,
  ): Promise<AthletesPhotoRecord | null>;
}
