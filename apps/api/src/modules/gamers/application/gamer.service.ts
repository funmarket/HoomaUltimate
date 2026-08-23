import { AppError } from "../../../http/errors/app-error.js";
import { gamerGameSlug, normalizeGamerGameName } from "../domain/gamer-game-normalization.js";
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

  async addGame(userId: string, input: { name: string }) {
    const name = input.name.normalize("NFKC").trim().replace(/\s+/g, " ");
    const normalizedName = normalizeGamerGameName(name);
    if (normalizedName.length < 2) {
      throw new AppError(400, "GAMER_GAME_NAME_INVALID", "Game name must contain at least two meaningful characters");
    }

    const existing = await this.games.getByNormalizedName(normalizedName);
    if (existing) {
      throw new AppError(409, "GAMER_GAME_ALREADY_EXISTS", "That game already exists");
    }

    const created = await this.games.create({
      name,
      normalizedName,
      slug: gamerGameSlug(normalizedName),
      createdByUserId: userId,
    });
    if (!created) {
      throw new AppError(409, "GAMER_GAME_ALREADY_EXISTS", "That game already exists");
    }
    return created;
  }
}
