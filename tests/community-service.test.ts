import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import type {
  CommunityJoinRequestRecord,
  CommunityRepository,
  CommunityRole,
} from "../apps/api/src/modules/communities/application/community.repository.js";
import { CommunityService } from "../apps/api/src/modules/communities/application/community.service.js";

function pendingRequest(userId = "user-1"): CommunityJoinRequestRecord {
  return {
    id: `request-${userId}`,
    communityId: "community-1",
    userId,
    status: "PENDING",
    requestedAt: new Date("2026-08-25T12:00:00.000Z"),
    resolvedAt: null,
  };
}

function repositoryStub(
  roles: Record<string, CommunityRole | null> = {},
  joinPolicy: "OPEN" | "APPROVAL_REQUIRED" = "OPEN",
): CommunityRepository {
  return {
    listPublic: async () => [],
    getPublic: async () => ({ id: "community-1" }),
    create: async () => ({ id: "community-1" }),
    lifecycle: async () => ({
      createdByUserId: "founder",
      status: "ACTIVE",
      visibility: joinPolicy === "OPEN" ? "PUBLIC" : "PRIVATE",
      joinPolicy,
      hasActiveTeam: false,
      hasPublishedEvent: false,
    }),
    membershipPolicy: async () => ({
      status: "ACTIVE",
      visibility: joinPolicy === "OPEN" ? "PUBLIC" : "PRIVATE",
      joinPolicy,
    }),
    update: async () => ({ id: "community-1" }),
    archive: async () => {},
    managerRole: async (_communityId, userId) => roles[userId] ?? null,
    joinOpen: async () => ({ role: "MEMBER" }),
    requestJoin: async (_communityId, userId) => ({
      kind: "REQUEST",
      request: pendingRequest(userId),
    }),
    getJoinRequest: async () => null,
    listJoinRequests: async () => [],
    resolveJoinRequest: async () => true,
    cancelJoinRequest: async () => true,
    addMemberByUsername: async () => ({ userId: "member", username: "member" }),
    leave: async () => {},
    listMembers: async () => [],
    removeMember: async () => {},
    appointCoach: async () => {},
    revokeCoach: async () => {},
  };
}

test("CommunityService keeps PUBLIC HOOMA join immediate", async () => {
  const service = new CommunityService(repositoryStub());
  assert.deepEqual(await service.join("user-1", "community-1"), {
    status: "JOINED",
    membership: { role: "MEMBER" },
  });
});

test("CommunityService creates a pending request for PRIVATE HOOMA", async () => {
  const service = new CommunityService(repositoryStub({}, "APPROVAL_REQUIRED"));
  assert.deepEqual(await service.join("user-1", "community-1"), {
    status: "PENDING",
    request: {
      id: "request-user-1",
      communityId: "community-1",
      userId: "user-1",
      status: "PENDING",
      requestedAt: "2026-08-25T12:00:00.000Z",
      resolvedAt: null,
    },
  });
});

test("CommunityService does not create a second request if membership wins the private join race", async () => {
  const repository = repositoryStub({}, "APPROVAL_REQUIRED");
  repository.requestJoin = async () => ({ kind: "MEMBERSHIP", role: "MEMBER" });
  const service = new CommunityService(repository);
  assert.deepEqual(await service.join("user-1", "community-1"), {
    status: "JOINED",
    membership: { role: "MEMBER" },
  });
});

test("CommunityService derives join policy from visibility on create and update", async () => {
  const repository = repositoryStub({ founder: "FOUNDER" });
  let createPolicy = "";
  let updatePolicy = "";
  repository.create = async (_userId, input) => {
    createPolicy = input.joinPolicy;
    return { id: "community-1" };
  };
  repository.update = async (_communityId, input) => {
    updatePolicy = input.joinPolicy ?? "";
    return { id: "community-1" };
  };
  const service = new CommunityService(repository);
  await service.create("founder", { name: "Private HOOMA", visibility: "PRIVATE" });
  await service.update("founder", "community-1", { visibility: "PUBLIC" });
  assert.equal(createPolicy, "APPROVAL_REQUIRED");
  assert.equal(updatePolicy, "OPEN");
});

test("CommunityService requires Founder to approve membership requests", async () => {
  const service = new CommunityService(repositoryStub({ founder: "FOUNDER", coach: "COACH" }));
  await assert.rejects(
    () => service.approveJoinRequest("coach", "community-1", "member"),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "COMMUNITY_FOUNDER_REQUIRED" &&
      error.statusCode === 403,
  );
  assert.deepEqual(await service.approveJoinRequest("founder", "community-1", "member"), {
    ok: true,
  });
});

test("CommunityService prevents Founder from leaving", async () => {
  const service = new CommunityService(repositoryStub({ founder: "FOUNDER" }));
  await assert.rejects(
    () => service.leave("founder", "community-1"),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "COMMUNITY_FOUNDER_CANNOT_LEAVE" &&
      error.statusCode === 409,
  );
});

test("CommunityService keeps member directory private to active members", async () => {
  const service = new CommunityService(repositoryStub());
  await assert.rejects(
    () => service.members("outsider", "community-1"),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "COMMUNITY_MEMBER_REQUIRED" &&
      error.statusCode === 403,
  );
});

test("CommunityService allows Coach to remove MEMBER but not another Coach", async () => {
  let removed = "";
  const repository = repositoryStub({ actor: "COACH", member: "MEMBER", coach: "COACH" });
  repository.removeMember = async (_communityId, userId) => {
    removed = userId;
  };
  const service = new CommunityService(repository);
  assert.deepEqual(await service.removeMember("actor", "community-1", "member"), { ok: true });
  assert.equal(removed, "member");
  await assert.rejects(
    () => service.removeMember("actor", "community-1", "coach"),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "COMMUNITY_COACH_SCOPE" &&
      error.statusCode === 403,
  );
});

test("CommunityService requires Coach promotion target to already be an active MEMBER", async () => {
  let promoted = false;
  const repository = repositoryStub({ founder: "FOUNDER", member: "MEMBER" });
  repository.appointCoach = async () => {
    promoted = true;
  };
  const service = new CommunityService(repository);
  await assert.rejects(
    () => service.appointCoach("founder", "community-1", "outsider"),
    (error: unknown) =>
      error instanceof AppError &&
      error.code === "COMMUNITY_MEMBER_NOT_FOUND" &&
      error.statusCode === 404,
  );
  assert.equal(promoted, false);
  assert.deepEqual(await service.appointCoach("founder", "community-1", "member"), { ok: true });
  assert.equal(promoted, true);
});

test("CommunityService allows Founder to demote Coach to MEMBER", async () => {
  let revoked = false;
  const repository = repositoryStub({ founder: "FOUNDER", coach: "COACH" });
  repository.revokeCoach = async () => {
    revoked = true;
  };
  const service = new CommunityService(repository);
  assert.deepEqual(await service.revokeCoach("founder", "community-1", "coach"), { ok: true });
  assert.equal(revoked, true);
});
