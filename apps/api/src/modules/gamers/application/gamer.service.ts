import { AppError } from "../../../http/errors/app-error.js";
import { gamerGameSlug, normalizeGamerGameName } from "../domain/gamer-game-normalization.js";
import type { GamerChallengeRepository } from "./gamer-challenge.repository.js";
import type { GamerGameRepository } from "./gamer-game.repository.js";
import type { GamerProfileRepository } from "./gamer-profile.repository.js";

export class GamerService {
  constructor(
    private readonly games: GamerGameRepository,
    private readonly profiles: GamerProfileRepository,
    private readonly challenges: GamerChallengeRepository,
  ) {}

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
      throw new AppError(
        400,
        "GAMER_GAME_NAME_INVALID",
        "Game name must contain at least two meaningful characters",
      );
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

  async listChallengers(gameId: string) {
    await this.requireActiveGame(gameId);
    return this.profiles.listOpenByGame(gameId);
  }

  async getPublicProfile(gameId: string, profileId: string) {
    await this.requireActiveGame(gameId);
    const profile = await this.profiles.getPublicByGameAndId(gameId, profileId);
    if (!profile) throw new AppError(404, "GAMER_PROFILE_NOT_FOUND", "Gamer profile not found");
    return profile;
  }

  async getMyProfile(userId: string, gameId: string) {
    await this.requireActiveGame(gameId);
    return this.profiles.getByUserAndGame(userId, gameId);
  }

  async upsertMyProfile(
    userId: string,
    gameId: string,
    input: { handle: string; openToChallenge: boolean },
  ) {
    await this.requireActiveGame(gameId);
    const handle = input.handle.normalize("NFKC").trim().replace(/\s+/g, " ");
    if (!handle) throw new AppError(400, "GAMER_HANDLE_INVALID", "Game handle is required");
    return this.profiles.upsert({
      userId,
      gameId,
      handle,
      openToChallenge: input.openToChallenge,
    });
  }

  async createChallenge(userId: string, gameId: string, challengedProfileId: string) {
    await this.requireActiveGame(gameId);
    const challenger = await this.profiles.getByUserAndGame(userId, gameId);
    if (!challenger) {
      throw new AppError(
        409,
        "GAMER_PROFILE_REQUIRED",
        "Create your gamer profile before challenging",
      );
    }

    const challenged = await this.profiles.getById(challengedProfileId);
    if (!challenged || challenged.gameId !== gameId) {
      throw new AppError(404, "GAMER_PROFILE_NOT_FOUND", "Gamer profile not found");
    }
    if (challenger.id === challenged.id) {
      throw new AppError(400, "GAMER_CHALLENGE_SELF_FORBIDDEN", "You cannot challenge yourself");
    }
    if (!challenged.openToChallenge) {
      throw new AppError(
        409,
        "GAMER_CHALLENGE_TARGET_CLOSED",
        "This gamer is not open to challenges",
      );
    }

    const pairKey = [challenger.id, challenged.id].sort().join(":");
    const challenge = await this.challenges.createPending({
      gameId,
      challengerProfileId: challenger.id,
      challengedProfileId: challenged.id,
      pairKey,
    });
    if (!challenge) {
      throw new AppError(
        409,
        "GAMER_CHALLENGE_ALREADY_PENDING",
        "A pending challenge already exists between these gamers",
      );
    }
    return challenge;
  }

  async listMyChallenges(userId: string, gameId: string) {
    await this.requireActiveGame(gameId);
    const profile = await this.profiles.getByUserAndGame(userId, gameId);
    if (!profile) return [];
    return this.challenges.listForUserAndGame(userId, gameId);
  }

  async acceptChallenge(userId: string, gameId: string, challengeId: string) {
    return this.transitionChallenge(userId, gameId, challengeId, "ACCEPTED");
  }

  async declineChallenge(userId: string, gameId: string, challengeId: string) {
    return this.transitionChallenge(userId, gameId, challengeId, "DECLINED");
  }

  async cancelChallenge(userId: string, gameId: string, challengeId: string) {
    await this.requireActiveGame(gameId);
    const access = await this.requireChallenge(gameId, challengeId);
    if (access.challengerUserId !== userId) {
      throw new AppError(
        403,
        "GAMER_CHALLENGE_FORBIDDEN",
        "Only the challenger can cancel this challenge",
      );
    }
    if (access.record.status === "CANCELLED") return access.record;
    if (access.record.status !== "PENDING") {
      throw new AppError(
        409,
        "GAMER_CHALLENGE_NOT_PENDING",
        "Only a pending challenge can be cancelled",
      );
    }
    const updated = await this.challenges.cancelForChallengerUser(challengeId, userId);
    if (!updated) {
      throw new AppError(
        409,
        "GAMER_CHALLENGE_STATE_CHANGED",
        "Challenge state changed; refresh and try again",
      );
    }
    return updated;
  }

  private async transitionChallenge(
    userId: string,
    gameId: string,
    challengeId: string,
    nextStatus: "ACCEPTED" | "DECLINED",
  ) {
    await this.requireActiveGame(gameId);
    const access = await this.requireChallenge(gameId, challengeId);
    if (access.challengedUserId !== userId) {
      throw new AppError(403, "GAMER_CHALLENGE_FORBIDDEN", "Only the challenged gamer can respond");
    }
    if (access.record.status === nextStatus) return access.record;
    if (access.record.status !== "PENDING") {
      throw new AppError(
        409,
        "GAMER_CHALLENGE_NOT_PENDING",
        "Only a pending challenge can be answered",
      );
    }
    const updated =
      nextStatus === "ACCEPTED"
        ? await this.challenges.acceptForChallengedUser(challengeId, userId)
        : await this.challenges.declineForChallengedUser(challengeId, userId);
    if (!updated) {
      throw new AppError(
        409,
        "GAMER_CHALLENGE_STATE_CHANGED",
        "Challenge state changed; refresh and try again",
      );
    }
    return updated;
  }

  private async requireChallenge(gameId: string, challengeId: string) {
    const access = await this.challenges.getAccessRecord(challengeId);
    if (!access || access.record.gameId !== gameId) {
      throw new AppError(404, "GAMER_CHALLENGE_NOT_FOUND", "Challenge not found");
    }
    return access;
  }

  private async requireActiveGame(gameId: string) {
    const game = await this.games.getActiveById(gameId);
    if (!game) throw new AppError(404, "GAMER_GAME_NOT_FOUND", "Game not found");
    return game;
  }
}
