import type {
  TeamCapabilityInput,
  TeamChallengeCreateInput,
  TeamCreateInput,
  TeamLineupInput,
  TeamUpdateInput
} from "@hooma/contracts";

export interface TeamListInput {
  limit: number;
  cursor?: string;
  search?: string;
  city?: string;
  houma?: string;
}

export interface TeamAccessRecord {
  readonly communityId: string | null;
  readonly responsibility: "COACH" | "ASSISTANT" | null;
  readonly grants: readonly TeamCapabilityInput[];
  readonly communityRole: "FOUNDER" | "COACH" | "MEMBER" | null;
}

export interface TeamLifecycleRecord {
  readonly createdByUserId: string;
  readonly status: "ACTIVE" | "ARCHIVED";
}

export interface TeamChallengeRecord {
  readonly id: string;
  readonly challengerTeamId: string;
  readonly challengedTeamId: string;
  readonly status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
}

export interface TeamRepository {
  listPublic(input: TeamListInput): Promise<unknown>;
  getPublic(teamId: string): Promise<unknown | null>;
  listMine(userId: string): Promise<unknown>;
  listManaged(userId: string): Promise<unknown>;
  access(teamId: string, userId: string): Promise<TeamAccessRecord | null>;
  lifecycle(teamId: string): Promise<TeamLifecycleRecord | null>;
  isActive(teamId: string): Promise<boolean>;
  create(userId: string, input: TeamCreateInput): Promise<unknown>;
  update(teamId: string, input: TeamUpdateInput): Promise<unknown>;
  archive(teamId: string): Promise<void>;
  addPlayer(teamId: string, targetUserId: string): Promise<unknown>;
  removePlayer(teamId: string, targetUserId: string): Promise<number>;
  assignAssistant(
    teamId: string,
    targetUserId: string,
    capabilities: readonly TeamCapabilityInput[],
    coachUserId: string
  ): Promise<void>;
  revokeAssistant(teamId: string, targetUserId: string): Promise<void>;
  listActivePlayerIds(teamId: string): Promise<string[]>;
  getCurrentLineup(teamId: string): Promise<unknown | null>;
  saveCurrentLineup(userId: string, teamId: string, input: TeamLineupInput): Promise<unknown>;
  createChallenge(userId: string, input: TeamChallengeCreateInput): Promise<unknown>;
  getChallenge(challengeId: string): Promise<TeamChallengeRecord | null>;
  getChallengeForUser(challengeId: string, userId: string): Promise<unknown | null>;
  listIncoming(userId: string, limit: number): Promise<unknown>;
  listOutgoing(userId: string, limit: number): Promise<unknown>;
  acceptChallenge(challengeId: string): Promise<unknown>;
  declineChallenge(challengeId: string): Promise<unknown>;
  cancelChallenge(challengeId: string): Promise<unknown>;
  listMessages(challengeId: string): Promise<unknown>;
  createMessage(challengeId: string, userId: string, body: string): Promise<unknown>;
  listGames(userId: string, limit: number): Promise<unknown>;
  getGame(gameId: string, userId: string): Promise<unknown | null>;
}
