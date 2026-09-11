import type { AthletesPhotoCreateInput, AthletesPhotoRecord } from "./athletes-photo.repository.js";
import type { AthletesRepository } from "./athletes.repository.js";

export interface AthletesPhotoTransactionRepository {
  createPrepared(input: AthletesPhotoCreateInput): Promise<AthletesPhotoRecord>;
  deleteAndScheduleCleanup(athletesCommunityId: string, photoId: string): Promise<boolean>;
}

export interface AthletesPhotoTransactionScope {
  readonly athletes: AthletesRepository;
  readonly photos: AthletesPhotoTransactionRepository;
}

export interface AthletesPhotoUnitOfWork {
  withCommunityLock<T>(
    athletesCommunityId: string,
    operation: (scope: AthletesPhotoTransactionScope) => Promise<T>,
  ): Promise<T>;
}
