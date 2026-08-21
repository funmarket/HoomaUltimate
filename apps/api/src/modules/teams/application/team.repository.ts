import type { TeamCapabilityInput, TeamChallengeCreateInput, TeamCreateInput, TeamLineupInput, TeamUpdateInput } from "@hooma/contracts";

export interface TeamListInput { limit: number; cursor?: string; search?: string; city?: string; houma?: string; }
export interface TeamAccessRecord {
  readonly communityId: string | null;
  readonly responsibility: "COACH" | "ASSISTANT" | null;
  readonly grants: readonly TeamCapabilityInput[];
  readonly communityRole: "FOUNDER" | "COACH" | "MEMBER" | null;
}
export interface TeamRepository {
  listPublic(input: TeamListInput): Promise<unknown>;
  getPublic(teamId: string): Promise<unknown | null>;
  listManaged(userId: string): Promise<unknown>;
  access(teamId: string, userId: string): Promise<TeamAccessRecord | null>;
  create(userId: string, input: TeamCreateInput): Promise<unknown>;
  update(teamId: string, input: TeamUpdateInput): Promise<unknown>;
  addPlayer(teamId: string, targetUserId: string): Promise<unknown>;
  removePlayer(teamId: string, targetUserId: string): Promise<number>;
  assignAssistant(teamId: string, targetUserId: string, capabilities: readonly TeamCapabilityInput[], coachUserId: string): Promise<void>;
  revokeAssistant(teamId: string, targetUserId: string): Promise<void>;
  createLineup(userId: string, teamId: string, input: TeamLineupInput): Promise<unknown>;
  createChallenge(userId: string, input: TeamChallengeCreateInput): Promise<unknown>;
  getChallenge(challengeId: string): Promise<{ id: string; challengerTeamId: string; challengedTeamId: string; status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" } | null>;
  getChallengeForUser(challengeId: string, userId: string): Promise<unknown | null>;
  listIncoming(userId: string, limit: number): Promise<unknown>;
  listOutgoing(userId: string, limit: number): Promise<unknown>;
  acceptChallenge(challengeId: string): Promise<unknown>;
  declineChallenge(challengeId: string): Promise<unknown>;
  cancelChallenge(challengeId: string): Promise<unknown>;
  listMessages(challengeId: string, userId: string): Promise<unknown | null>;
  createMessage(challengeId: string, userId: string, body: string): Promise<unknown | null>;
  listGames(userId: string, limit: number): Promise<unknown>;
  getGame(gameId: string, userId: string): Promise<unknown | null>;
}
