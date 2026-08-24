import assert from "node:assert/strict";
import test from "node:test";
import type { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import type {
  TeamAccessRecord,
  TeamChallengeRecord,
  TeamListInput,
  TeamRepository,
} from "../apps/api/src/modules/teams/application/team.repository.js";
import { TeamService } from "../apps/api/src/modules/teams/application/team.service.js";
import type {
  TeamChallengeCreateInput,
  TeamCreateInput,
  TeamLineupInput,
  TeamUpdateInput,
} from "@hooma/contracts";
import { AppError } from "../apps/api/src/http/errors/app-error.js";

class ChallengePolicyRepository implements TeamRepository {
  challengeRecord: TeamChallengeRecord | null = null;
  readonly accessByTeam = new Map<string, TeamAccessRecord | null>();
  messageReads = 0;
  messageWrites = 0;

  listPublic(_input: TeamListInput): Promise<unknown> {
    return Promise.resolve([]);
  }
  getPublic(): Promise<unknown | null> {
    return Promise.resolve(null);
  }
  listManaged(): Promise<unknown> {
    return Promise.resolve([]);
  }
  access(teamId: string): Promise<TeamAccessRecord | null> {
    return Promise.resolve(this.accessByTeam.get(teamId) ?? null);
  }
  create(_userId: string, input: TeamCreateInput): Promise<unknown> {
    return Promise.resolve(input);
  }
  update(_teamId: string, input: TeamUpdateInput): Promise<unknown> {
    return Promise.resolve(input);
  }
  addPlayer(): Promise<unknown> {
    return Promise.resolve({});
  }
  removePlayer(): Promise<number> {
    return Promise.resolve(0);
  }
  assignAssistant(): Promise<void> {
    return Promise.resolve();
  }
  revokeAssistant(): Promise<void> {
    return Promise.resolve();
  }
  createLineup(_userId: string, _teamId: string, input: TeamLineupInput): Promise<unknown> {
    return Promise.resolve(input);
  }
  createChallenge(_userId: string, input: TeamChallengeCreateInput): Promise<unknown> {
    return Promise.resolve(input);
  }
  getChallenge(): Promise<TeamChallengeRecord | null> {
    return Promise.resolve(this.challengeRecord);
  }
  getChallengeForUser(): Promise<unknown | null> {
    return Promise.resolve(null);
  }
  listIncoming(): Promise<unknown> {
    return Promise.resolve([]);
  }
  listOutgoing(): Promise<unknown> {
    return Promise.resolve([]);
  }
  acceptChallenge(): Promise<unknown> {
    return Promise.resolve({});
  }
  declineChallenge(): Promise<unknown> {
    return Promise.resolve({});
  }
  cancelChallenge(): Promise<unknown> {
    return Promise.resolve({});
  }
  listMessages(): Promise<unknown> {
    this.messageReads += 1;
    return Promise.resolve([]);
  }
  createMessage(): Promise<unknown> {
    this.messageWrites += 1;
    return Promise.resolve({ id: "message-1" });
  }
  listGames(): Promise<unknown> {
    return Promise.resolve([]);
  }
  getGame(): Promise<unknown | null> {
    return Promise.resolve(null);
  }
}

const communities = {} as CommunityService;
const accepted: TeamChallengeRecord = {
  id: "challenge-1",
  challengerTeamId: "team-a",
  challengedTeamId: "team-b",
  status: "ACCEPTED",
};

function assistant(...grants: TeamAccessRecord["grants"]): TeamAccessRecord {
  return {
    communityId: "community-1",
    responsibility: "ASSISTANT",
    grants,
    communityRole: "MEMBER",
  };
}

test("Assistant without RESPOND_TO_CHALLENGE cannot read accepted challenge coordination", async () => {
  const repo = new ChallengePolicyRepository();
  repo.challengeRecord = accepted;
  repo.accessByTeam.set("team-a", assistant("CREATE_CHALLENGE"));
  const service = new TeamService(repo, communities);

  await assert.rejects(
    () => service.messages("assistant-1", accepted.id),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 404 &&
      error.code === "TEAM_CHALLENGE_NOT_FOUND",
  );
  assert.equal(repo.messageReads, 0);
});

test("Assistant with RESPOND_TO_CHALLENGE can read and write accepted coordination", async () => {
  const repo = new ChallengePolicyRepository();
  repo.challengeRecord = accepted;
  repo.accessByTeam.set("team-a", assistant("RESPOND_TO_CHALLENGE"));
  const service = new TeamService(repo, communities);

  await service.messages("assistant-1", accepted.id);
  await service.createMessage("assistant-1", accepted.id, "Kickoff at 20:00");
  assert.equal(repo.messageReads, 1);
  assert.equal(repo.messageWrites, 1);
});

test("challenge coordination remains closed before acceptance even for authorized Coach", async () => {
  const repo = new ChallengePolicyRepository();
  repo.challengeRecord = { ...accepted, status: "PENDING" };
  repo.accessByTeam.set("team-b", {
    communityId: "community-1",
    responsibility: "COACH",
    grants: [],
    communityRole: null,
  });
  const service = new TeamService(repo, communities);

  await assert.rejects(
    () => service.createMessage("coach-1", accepted.id, "Too early"),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 409 &&
      error.code === "TEAM_CHALLENGE_COORDINATION_NOT_OPEN",
  );
  assert.equal(repo.messageWrites, 0);
});

test("Community Founder fallback can coordinate an accepted challenge", async () => {
  const repo = new ChallengePolicyRepository();
  repo.challengeRecord = accepted;
  repo.accessByTeam.set("team-b", {
    communityId: "community-1",
    responsibility: null,
    grants: [],
    communityRole: "FOUNDER",
  });
  const service = new TeamService(repo, communities);

  await service.messages("founder-1", accepted.id);
  assert.equal(repo.messageReads, 1);
});
