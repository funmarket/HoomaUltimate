import type { PlayPlayerListingInput } from "@hooma/contracts/play";

export interface PlayPlayerListingRepository {
  listPublic(limit: number): Promise<unknown>;
  getMine(userId: string): Promise<unknown | null>;
  saveMine(userId: string, input: PlayPlayerListingInput): Promise<unknown>;
  removeMine(userId: string): Promise<boolean>;
}
