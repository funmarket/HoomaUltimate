import assert from "node:assert/strict";
import test from "node:test";
import { TeamService } from "../apps/api/src/modules/teams/application/team.service.js";
import type {
  TeamRepository,
  TeamAccessRecord,
  TeamListInput,
} from "../apps/api/src/modules/teams/application/team.repository.js";
import type { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";
import type {
  TeamChallengeCreateInput,
  TeamCreateInput,
  TeamLineupInput,
  TeamUpdateInput,
} from "@hooma/contracts";
class FakeTeamRepository implements TeamRepository {
  accessRecord: TeamAccessRecord | null = null;
  createdChallenges = 0;
  listPublic(_input: TeamListInput): Promise<unknown> {
    return Promise.resolve([]);
  }
  getPublic(): Promise<unknown | null> {
    return Promise.resolve({ id: "team" });
  }
  listManaged(): Promise<unknown> {
    return Promise.resolve([]);
  }
  access(): Promise<TeamAccessRecord | null> {
    return Promise.resolve(this.accessRecord);
  }
  create(_u: string, input: TeamCreateInput): Promise<unknown> {
    return Promise.resolve(input);
  }
  update(_t: string, input: TeamUpdateInput): Promise<unknown> {
    return Promise.resolve(input);
  }
  addPlayer(): Promise<unknown> {
    return Promise.resolve({});
  }
  removePlayer(): Promise<number> {
    return Promise.resolve(1);
  }
  assignAssistant(): Promise<void> {
    return Promise.resolve();
  }
  revokeAssistant(): Promise<void> {
    return Promise.resolve();
  }
  createLineup(_u: string, _t: string, input: TeamLineupInput): Promise<unknown> {
    return Promise.resolve(input);
  }
  createChallenge(_u: string, input: TeamChallengeCreateInput): Promise<unknown> {
    this.createdChallenges += 1;
    return Promise.resolve(input);
  }
  getChallenge(): Promise<any> {
    return Promise.resolve(null);
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
  listMessages(): Promise<unknown | null> {
    return Promise.resolve([]);
  }
  createMessage(): Promise<unknown | null> {
    return Promise.resolve({});
  }
  listGames(): Promise<unknown> {
    return Promise.resolve([]);
  }
  getGame(): Promise<unknown | null> {
    return Promise.resolve({});
  }
}
const communities = { requireCoach: async () => undefined } as unknown as CommunityService;
test("Community Founder/Coach fallback keeps mature Team management authority", async () => {
  const repo = new FakeTeamRepository();
  repo.accessRecord = {
    communityId: "c1",
    responsibility: null,
    grants: [],
    communityRole: "COACH",
  };
  const service = new TeamService(repo, communities);
  await assert.doesNotReject(() => service.requireCapability("u1", "t1", "EDIT_TEAM"));
});
test("Assistant receives only explicitly granted capabilities", async () => {
  const repo = new FakeTeamRepository();
  repo.accessRecord = {
    communityId: "c1",
    responsibility: "ASSISTANT",
    grants: ["MANAGE_LINEUP"],
    communityRole: "MEMBER",
  };
  const service = new TeamService(repo, communities);
  await assert.doesNotReject(() => service.requireCapability("u1", "t1", "MANAGE_LINEUP"));
  await assert.rejects(() => service.requireCapability("u1", "t1", "MANAGE_ROSTER"));
});
test("Team cannot challenge itself before repository write", async () => {
  const repo = new FakeTeamRepository();
  repo.accessRecord = {
    communityId: "c1",
    responsibility: "COACH",
    grants: [],
    communityRole: null,
  };
  const service = new TeamService(repo, communities);
  await assert.rejects(
    () =>
      service.createChallenge("u1", {
        challengerTeamId: "same",
        challengedTeamId: "same",
        format: "FIVE_V_FIVE",
        proposedAt: null,
        message: null,
      }),
    /cannot challenge itself/i,
  );
  assert.equal(repo.createdChallenges, 0);
});
