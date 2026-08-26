import type { ObjectStorage } from "@hooma/storage";
import type { GamerDisputeResolutionInput, GamerMatchSide } from "@hooma/contracts/gamers";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";
import type { GamerChallengeRepository } from "./gamer-challenge.repository.js";
import type { GamerGameRepository } from "./gamer-game.repository.js";
import type { GamerMatchRepository } from "./gamer-match.repository.js";

const EA_FC_MOBILE_SLUG = "ea-sports-fc-mobile";
const RESULT_PROOF_MAX_BYTES = 5 * 1024 * 1024;
const SINGLE_SUBMISSION_TIMEOUT_MS = 30 * 60 * 1000;
const ALLOWED_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class GamerMatchService {
  constructor(
    private readonly games: GamerGameRepository,
    private readonly challenges: GamerChallengeRepository,
    private readonly matches: GamerMatchRepository,
    private readonly storage: ObjectStorage | null,
    private readonly platformAdmin: PlatformAdminAuthorizer,
  ) {}

  async getMatch(userId: string, gameId: string, challengeId: string) {
    const access = await this.requireAcceptedEaFcChallenge(userId, gameId, challengeId);
    return this.matches.ensureForAcceptedChallenge(access.record.id);
  }

  async setRoomCode(userId: string, gameId: string, challengeId: string, roomCode: string) {
    const access = await this.requireAcceptedEaFcChallenge(userId, gameId, challengeId);
    if (access.challengerUserId !== userId) {
      throw new AppError(
        403,
        "GAMER_MATCH_HOST_REQUIRED",
        "Only the challenger can publish the EA FC room code",
      );
    }
    const match = await this.matches.ensureForAcceptedChallenge(challengeId);
    const updated = await this.matches.setRoomCode(match.id, roomCode);
    if (!updated) {
      throw new AppError(
        409,
        "GAMER_MATCH_STATE_CHANGED",
        "Match state changed; refresh and try again",
      );
    }
    return updated;
  }

  async submitResult(
    userId: string,
    gameId: string,
    challengeId: string,
    input: { yourScore: number; opponentScore: number; contentType: string; proof: Uint8Array },
  ) {
    const access = await this.requireAcceptedEaFcChallenge(userId, gameId, challengeId);
    if (!ALLOWED_PROOF_TYPES.has(input.contentType)) {
      throw new AppError(415, "GAMER_MATCH_PROOF_TYPE_INVALID", "Proof must be JPEG, PNG, or WebP");
    }
    if (!input.proof.byteLength || input.proof.byteLength > RESULT_PROOF_MAX_BYTES) {
      throw new AppError(
        413,
        "GAMER_MATCH_PROOF_TOO_LARGE",
        "Match proof must be between 1 byte and 5 MB",
      );
    }
    if (!this.storage) {
      throw new AppError(
        503,
        "OBJECT_STORAGE_NOT_CONFIGURED",
        "Match proof storage is not configured",
      );
    }

    const side: GamerMatchSide = access.challengerUserId === userId ? "CHALLENGER" : "CHALLENGED";
    const challengerScore = side === "CHALLENGER" ? input.yourScore : input.opponentScore;
    const challengedScore = side === "CHALLENGER" ? input.opponentScore : input.yourScore;
    const match = await this.matches.ensureForAcceptedChallenge(challengeId);
    if (!match.roomCode) {
      throw new AppError(
        409,
        "GAMER_MATCH_ROOM_CODE_REQUIRED",
        "The EA FC room code must be published before results can be submitted",
      );
    }
    if (["VERIFIED", "DISPUTED", "VOIDED"].includes(match.status)) {
      throw new AppError(409, "GAMER_MATCH_RESULT_LOCKED", "This match result is already locked");
    }

    const proofObjectKey = `gamer-match-proofs/${match.id}/${side.toLowerCase()}`;
    const stored = await this.storage.put(proofObjectKey, input.proof, input.contentType);
    const deadline = new Date(Date.now() + SINGLE_SUBMISSION_TIMEOUT_MS);
    const updated = await this.matches.saveSubmission({
      matchId: match.id,
      side,
      challengerScore,
      challengedScore,
      proofObjectKey: stored.key,
      proofContentType: stored.contentType,
      proofSizeBytes: stored.sizeBytes,
      deadline,
    });
    if (!updated) {
      throw new AppError(
        409,
        "GAMER_MATCH_STATE_CHANGED",
        "Match state changed while the result was submitted",
      );
    }
    return updated;
  }

  async listDisputes(adminUserId: string) {
    await this.platformAdmin.requirePlatformAdmin(adminUserId);
    return { items: await this.matches.listDisputes() };
  }

  async resolveDispute(
    adminUserId: string,
    matchId: string,
    resolution: GamerDisputeResolutionInput,
  ) {
    await this.platformAdmin.requirePlatformAdmin(adminUserId);
    const updated = await this.matches.resolveDispute({
      matchId,
      actorUserId: adminUserId,
      resolution,
    });
    if (!updated) {
      throw new AppError(409, "GAMER_MATCH_NOT_DISPUTED", "Match is no longer disputed");
    }
    return updated;
  }

  async getDisputeProof(adminUserId: string, matchId: string, side: GamerMatchSide) {
    await this.platformAdmin.requirePlatformAdmin(adminUserId);
    if (!this.storage) {
      throw new AppError(
        503,
        "OBJECT_STORAGE_NOT_CONFIGURED",
        "Match proof storage is not configured",
      );
    }
    const submission = await this.matches.getSubmissionProof(matchId, side);
    if (!submission) {
      throw new AppError(404, "GAMER_MATCH_PROOF_NOT_FOUND", "Match proof not found");
    }
    return this.storage.get(submission.proofObjectKey);
  }

  private async requireAcceptedEaFcChallenge(userId: string, gameId: string, challengeId: string) {
    const game = await this.games.getActiveById(gameId);
    if (!game || game.slug !== EA_FC_MOBILE_SLUG) {
      throw new AppError(
        404,
        "EA_FC_MATCH_BRIDGE_NOT_AVAILABLE",
        "EA SPORTS FC Mobile match bridge is not available for this game",
      );
    }
    const access = await this.challenges.getAccessRecord(challengeId);
    if (!access || access.record.gameId !== gameId) {
      throw new AppError(404, "GAMER_CHALLENGE_NOT_FOUND", "Challenge not found");
    }
    if (access.challengerUserId !== userId && access.challengedUserId !== userId) {
      throw new AppError(
        403,
        "GAMER_MATCH_FORBIDDEN",
        "Only match participants can access this EA FC match",
      );
    }
    if (access.record.status !== "ACCEPTED") {
      throw new AppError(
        409,
        "GAMER_MATCH_REQUIRES_ACCEPTED_CHALLENGE",
        "The challenge must be accepted before creating an EA FC match",
      );
    }
    return access;
  }
}
