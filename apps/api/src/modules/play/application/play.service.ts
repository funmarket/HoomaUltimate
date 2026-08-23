import type { PlayPlayerListingInput } from "@hooma/contracts/play";
import type { PlayPlayerListingRepository } from "./play.repository.js";

export class PlayService {
  constructor(private readonly repository: PlayPlayerListingRepository) {}

  listPublic(limit = 30) {
    return this.repository.listPublic(Math.min(Math.max(limit, 1), 100));
  }

  getMine(userId: string) {
    return this.repository.getMine(userId);
  }

  saveMine(userId: string, input: PlayPlayerListingInput) {
    return this.repository.saveMine(userId, input);
  }

  async removeMine(userId: string) {
    return { removed: await this.repository.removeMine(userId) };
  }
}
