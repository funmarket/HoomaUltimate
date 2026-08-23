import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import type { CommunityRepository, CommunityRole } from "../apps/api/src/modules/communities/application/community.repository.js";
import { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";

function repositoryStub(roles: Record<string, CommunityRole | null> = {}): CommunityRepository {
  return {
    listPublic: async () => [],
    getPublic: async () => ({ id: "community-1" }),
    create: async () => ({ id: "community-1" }),
    managerRole: async (_communityId, userId) => roles[userId] ?? null,
    join: async () => ({ role: "MEMBER" }),
    leave: async () => {},
    listMembers: async () => [],
    removeMember: async () => {},
    appointCoach: async () => {},
    revokeCoach: async () => {}
  };
}

test("CommunityService lets an authenticated outsider join as MEMBER", async () => {
  const service = new CommunityService(repositoryStub());
  assert.deepEqual(await service.join("user-1", "community-1"), { membership: { role: "MEMBER" } });
});

test("CommunityService prevents Founder from leaving", async () => {
  const service = new CommunityService(repositoryStub({ founder: "FOUNDER" }));
  await assert.rejects(
    () => service.leave("founder", "community-1"),
    (error: unknown) => error instanceof AppError && error.code === "COMMUNITY_FOUNDER_CANNOT_LEAVE" && error.statusCode === 409
  );
});

test("CommunityService keeps member directory private to active members", async () => {
  const service = new CommunityService(repositoryStub());
  await assert.rejects(
    () => service.members("outsider", "community-1"),
    (error: unknown) => error instanceof AppError && error.code === "COMMUNITY_MEMBER_REQUIRED" && error.statusCode === 403
  );
});

test("CommunityService allows Coach to remove MEMBER but not another Coach", async () => {
  let removed = "";
  const repository = repositoryStub({ actor: "COACH", member: "MEMBER", coach: "COACH" });
  repository.removeMember = async (_communityId, userId) => { removed = userId; };
  const service = new CommunityService(repository);
  assert.deepEqual(await service.removeMember("actor", "community-1", "member"), { ok: true });
  assert.equal(removed, "member");
  await assert.rejects(
    () => service.removeMember("actor", "community-1", "coach"),
    (error: unknown) => error instanceof AppError && error.code === "COMMUNITY_COACH_SCOPE" && error.statusCode === 403
  );
});

test("CommunityService requires Coach promotion target to already be an active MEMBER", async () => {
  let promoted = false;
  const repository = repositoryStub({ founder: "FOUNDER", member: "MEMBER" });
  repository.appointCoach = async () => { promoted = true; };
  const service = new CommunityService(repository);
  await assert.rejects(
    () => service.appointCoach("founder", "community-1", "outsider"),
    (error: unknown) => error instanceof AppError && error.code === "COMMUNITY_MEMBER_NOT_FOUND" && error.statusCode === 404
  );
  assert.equal(promoted, false);
  assert.deepEqual(await service.appointCoach("founder", "community-1", "member"), { ok: true });
  assert.equal(promoted, true);
});

test("CommunityService allows Founder to demote Coach to MEMBER", async () => {
  let revoked = false;
  const repository = repositoryStub({ founder: "FOUNDER", coach: "COACH" });
  repository.revokeCoach = async () => { revoked = true; };
  const service = new CommunityService(repository);
  assert.deepEqual(await service.revokeCoach("founder", "community-1", "coach"), { ok: true });
  assert.equal(revoked, true);
});
