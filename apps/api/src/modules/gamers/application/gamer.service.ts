import { AppError } from "../../../http/errors/app-error.js";
import type { GamerGameRepository } from "./gamer-game.repository.js";

/**
 * Canonical Gamers application-service owner.
 *
 * G0 intentionally keeps only catalog read behavior from the old experiment.
 * G1 expands this service around persisted game creation/duplicate policy rather
 * than introducing a second Gamers service tree.
 */
export class GamerService {
  constructor(private readonly games: GamerGameRepository) {}

  listGames() {
    return this.games.listActive();
  }

  async getGame(slug: string) {
    const game = await this.games.getActive(slug);
    if (!game) throw new AppError(404, "GAMER_GAME_NOT_FOUND", "Game not found");
    return game;
  }
}
