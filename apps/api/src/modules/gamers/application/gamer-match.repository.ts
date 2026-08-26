import type {
  GamerChallengeParticipant,
  GamerDisputeResolutionInput,
  GamerMatchResolution,
  GamerMatchSessionStatus,
  GamerMatchSide,
} from "@hooma/contracts/gamers";

export type GamerMatchSubmissionRecord = {
  id: string;
  side: GamerMatchSide;
  challengerScore: number;
  challengedScore: number;
  proofObjectKey: string;
  proofContentType: string;
  proofSizeBytes: number;
  submittedAt: Date;
};

export type GamerMatchSessionRecord = {
  id: string;
  challengeId: string;
  status: GamerMatchSessionStatus;
  roomCode: string | null;
  submissionDeadline: Date | null;
  finalChallengerScore: number | null;
  finalChallengedScore: number | null;
  winnerSide: GamerMatchSide | null;
  resolution: GamerMatchResolution | null;
  resolvedAt: Date | null;
  submissions: GamerMatchSubmissionRecord[];
};

export type GamerMatchDisputeRecord = GamerMatchSessionRecord & {
  game: { id: string; slug: string; name: string };
  challenger: GamerChallengeParticipant;
  challenged: GamerChallengeParticipant;
};

export interface GamerMatchRepository {
  getByChallengeId(challengeId: string): Promise<GamerMatchSessionRecord | null>;
  ensureForAcceptedChallenge(challengeId: string): Promise<GamerMatchSessionRecord>;
  setRoomCode(matchId: string, roomCode: string): Promise<GamerMatchSessionRecord | null>;
  saveSubmission(input: {
    matchId: string;
    side: GamerMatchSide;
    challengerScore: number;
    challengedScore: number;
    proofObjectKey: string;
    proofContentType: string;
    proofSizeBytes: number;
    deadline: Date;
  }): Promise<GamerMatchSessionRecord | null>;
  listPendingVerification(limit: number): Promise<GamerMatchSessionRecord[]>;
  verifyIfPending(input: {
    matchId: string;
    challengerScore: number;
    challengedScore: number;
    winnerSide: GamerMatchSide | null;
    resolution: "MATCHED_SUBMISSIONS" | "SINGLE_SUBMISSION_TIMEOUT";
  }): Promise<boolean>;
  disputeIfPending(matchId: string): Promise<boolean>;
  listDisputes(): Promise<GamerMatchDisputeRecord[]>;
  resolveDispute(input: {
    matchId: string;
    actorUserId: string;
    resolution: GamerDisputeResolutionInput;
  }): Promise<GamerMatchSessionRecord | null>;
  getSubmissionProof(
    matchId: string,
    side: GamerMatchSide,
  ): Promise<GamerMatchSubmissionRecord | null>;
}
