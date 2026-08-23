import { AppError } from "../../../http/errors/app-error.js";
import type { GamerGameRepository } from "./gamer-game.repository.js";

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
