import type { GamerPublicPresentation } from "./gamer-profile.repository.js";

export type GamerChallengeStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";

export type GamerChallengeParticipant = {
  id: string;
  handle: string;
  presentation: Omit<GamerPublicPresentation, "bio">;
};

export type GamerChallengeRecord = {
  id: string;
  gameId: string;
  status: GamerChallengeStatus;
  createdAt: Date;
  respondedAt: Date | null;
  cancelledAt: Date | null;
  challenger: GamerChallengeParticipant;
  challenged: GamerChallengeParticipant;
};

export type GamerChallengeAccessRecord = {
  record: GamerChallengeRecord;
  challengerUserId: string;
  challengedUserId: string;
};

export interface GamerChallengeRepository {
  createPending(input: {
    gameId: string;
    challengerProfileId: string;
    challengedProfileId: string;
    pairKey: string;
  }): Promise<GamerChallengeRecord | null>;
  getAccessRecord(challengeId: string): Promise<GamerChallengeAccessRecord | null>;
  listForUserAndGame(userId: string, gameId: string): Promise<GamerChallengeRecord[]>;
  acceptForChallengedUser(
    challengeId: string,
    userId: string,
  ): Promise<GamerChallengeRecord | null>;
  declineForChallengedUser(
    challengeId: string,
    userId: string,
  ): Promise<GamerChallengeRecord | null>;
  cancelForChallengerUser(
    challengeId: string,
    userId: string,
  ): Promise<GamerChallengeRecord | null>;
}
