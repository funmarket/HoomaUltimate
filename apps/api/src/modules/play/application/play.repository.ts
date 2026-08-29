import type { PlayLookingFor, PlayPlayerListingInput } from "@hooma/contracts/play";

export interface PlayPlayerListingTarget {
  readonly listingId: string;
  readonly userId: string;
}

export interface PlayPlayerListingRepository {
  listPublic(limit: number): Promise<unknown>;
  getMine(userId: string): Promise<unknown | null>;
  saveMine(userId: string, input: PlayPlayerListingInput): Promise<unknown>;
  removeMine(userId: string): Promise<boolean>;
  resolveTarget(listingId: string, lookingFor: PlayLookingFor): Promise<PlayPlayerListingTarget | null>;
  listByUserIds(userIds: string[], lookingFor: PlayLookingFor): Promise<PlayPlayerListingTarget[]>;
}
