import assert from "node:assert/strict";
import test from "node:test";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";
import type {
  AthletesCommunityRecord,
  AthletesJoinRequestRecord,
  AthletesMembershipRecord,
  AthletesRepository,
  AthletesRole,
} from "../apps/api/src/modules/athletes/application/athletes.repository.js";
import { AthletesService } from "../apps/api/src/modules/athletes/application/athletes.service.js";

function community(joinPolicy: "OPEN" | "APPROVAL_REQUIRED" = "OPEN"): AthletesCommunityRecord {
  return {
    id: "ath-1",
    slug: "carthage-runners",
    name: "Carthage Runners",
    sport: "RUNNING",
    description: null,
    city: "Tunis",
    houma: "Carthage",
    logoUrl: null,
    bannerUrl: null,
    visibility: joinPolicy === "OPEN" ? "PUBLIC" : "PRIVATE",
    joinPolicy,
    status: "ACTIVE",
    createdByUserId: "founder",
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
  };
}

function membership(userId: string, role: AthletesRole = "MEMBER"): AthletesMembershipRecord {
  return {
    id: `mem-${userId}`,
    athletesCommunityId: "ath-1",
    userId,
    role,
    joinedAt: new Date("2026-09-01T10:00:00.000Z"),
    leftAt: null,
  };
}

function pending(userId = "member"): AthletesJoinRequestRecord {
  return {
    id: `req-${userId}`,
    athletesCommunityId: "ath-1",
    userId,
    status: "PENDING",
    requestedAt: new Date("2026-09-01T10:00:00.000Z"),
    resolvedAt: null,
    resolvedByUserId: null,
  };
}

function repositoryStub(
  roles: Record<string, AthletesRole | null> = {},
  joinPolicy: "OPEN" | "APPROVAL_REQUIRED" = "OPEN",
): AthletesRepository {
  const repository: AthletesRepository = {
    withCommunityLock: async (_id, operation) => operation(repository),
    listPublic: async () => ({ items: [], nextCursor: null }),
    getPublic: async () => ({
      ...community(joinPolicy),
      memberCount: 1,
      createdAt: "2026-09-01T10:00:00.000Z",
      updatedAt: "2026-09-01T10:00:00.000Z",
    }),
    createWithFounder: async (userId, input) => ({
      ...community(input.joinPolicy),
      id: "created-athletes",
      createdByUserId: userId,
      name: input.name,
    }),
    update: async (_id, input) => ({ ...community(), ...input }),
    archive: async () => true,
    lifecycle: async () => community(joinPolicy),
    managerRole: async (_id, userId) => roles[userId] ?? null,
    activeRole: async (_id, userId) => roles[userId] ?? null,
    joinOpen: async (_id, userId) => membership(userId),
    requestJoin: async (_id, userId) => ({ kind: "REQUEST", request: pending(userId) }),
    getJoinRequest: async () => null,
    listJoinRequests: async () => ({ items: [], nextCursor: null }),
    resolveJoinRequest: async () => true,
    cancelJoinRequest: async () => true,
    listMembers: async () => ({ items: [], nextCursor: null }),
    addMemberByUsername: async () => ({ userId: "target", username: "target" }),
    removeMember: async () => true,
    setRole: async () => true,
  };
  return repository;
}

const noLastSeen = {
  findLastSeenByUserIds: async () => new Map<string, Date | null>(),
};

test("AthletesService creates a community with founder membership atomically", async () => {
  let receivedUserId = "";
  let receivedPolicy = "";
  const repo = repositoryStub({ founder: "FOUNDER" });
  repo.createWithFounder = async (userId, input) => {
    receivedUserId = userId;
    receivedPolicy = input.joinPolicy;
    return {
      ...community("APPROVAL_REQUIRED"),
      id: "created-athletes",
      createdByUserId: userId,
      name: input.name,
    };
  };
  const service = new AthletesService(repo, noLastSeen);
  const created = await service.create("founder", {
    name: "Private Runners",
    sport: "RUNNING",
    visibility: "PRIVATE",
    joinPolicy: "OPEN",
  });
  assert.equal(created.id, "created-athletes");
  assert.equal(receivedUserId, "founder");
  assert.equal(receivedPolicy, "APPROVAL_REQUIRED");
});

test("AthletesService joins OPEN communities immediately", async () => {
  const service = new AthletesService(repositoryStub(), noLastSeen);
  assert.deepEqual(await service.join("member", "ath-1"), {
    status: "JOINED",
    membership: { role: "MEMBER" },
  });
});

test("AthletesService creates pending requests for approval-required communities", async () => {
  const service = new AthletesService(repositoryStub({}, "APPROVAL_REQUIRED"), noLastSeen);
  assert.deepEqual(await service.join("member", "ath-1"), {
    status: "PENDING",
    request: {
      id: "req-member",
      athletesCommunityId: "ath-1",
      userId: "member",
      status: "PENDING",
      requestedAt: "2026-09-01T10:00:00.000Z",
      resolvedAt: null,
      resolvedByUserId: null,
    },
  });
});

test("AthletesService requires Founder or Moderator for request management", async () => {
  const service = new AthletesService(
    repositoryStub({ moderator: "MODERATOR", member: "MEMBER" }, "APPROVAL_REQUIRED"),
    noLastSeen,
  );
  await assert.rejects(
    () => service.approveJoinRequest("member", "ath-1", "target"),
    (error: unknown) =>
      error instanceof AthletesError && error.code === "ATHLETES_MANAGER_REQUIRED",
  );
  assert.deepEqual(await service.approveJoinRequest("moderator", "ath-1", "target"), { ok: true });
});

test("AthletesService direct add resolves canonical username and rejects missing users", async () => {
  const repo = repositoryStub({ founder: "FOUNDER" });
  const service = new AthletesService(repo, noLastSeen);
  assert.deepEqual(await service.addMember("founder", "ath-1", "target"), {
    member: { userId: "target", username: "target" },
  });
  repo.addMemberByUsername = async () => null;
  await assert.rejects(
    () => service.addMember("founder", "ath-1", "missing"),
    (error: unknown) => error instanceof AthletesError && error.code === "ATHLETES_USER_NOT_FOUND",
  );
});

test("AthletesService keeps PRIVATE communities approval-required on update", async () => {
  let receivedPolicy = "";
  const repo = repositoryStub({ founder: "FOUNDER" }, "APPROVAL_REQUIRED");
  repo.update = async (_id, input) => {
    receivedPolicy = input.joinPolicy ?? "";
    return {
      ...community("APPROVAL_REQUIRED"),
      ...input,
      joinPolicy: input.joinPolicy ?? "APPROVAL_REQUIRED",
    };
  };
  const service = new AthletesService(repo, noLastSeen);
  await service.update("founder", "ath-1", { joinPolicy: "OPEN" });
  assert.equal(receivedPolicy, "APPROVAL_REQUIRED");
});

test("AthletesService protects final Founder authority and Moderator scope", async () => {
  const service = new AthletesService(
    repositoryStub({
      founder: "FOUNDER",
      moderator: "MODERATOR",
      targetFounder: "FOUNDER",
      targetModerator: "MODERATOR",
      member: "MEMBER",
    }),
    noLastSeen,
  );
  await assert.rejects(
    () => service.removeMember("founder", "ath-1", "targetFounder"),
    (error: unknown) =>
      error instanceof AthletesError && error.code === "ATHLETES_FOUNDER_REMOVE_FORBIDDEN",
  );
  await assert.rejects(
    () => service.removeMember("moderator", "ath-1", "targetModerator"),
    (error: unknown) => error instanceof AthletesError && error.code === "ATHLETES_MODERATOR_SCOPE",
  );
  await assert.rejects(
    () => service.setRole("founder", "ath-1", "targetFounder", "MEMBER"),
    (error: unknown) =>
      error instanceof AthletesError && error.code === "ATHLETES_FOUNDER_ROLE_FORBIDDEN",
  );
});

test("AthletesService allows Founder content for an active Founder in the same community", async () => {
  const repo = repositoryStub();
  let checkedCommunityId = "";
  repo.managerRole = async (id, userId) => {
    checkedCommunityId = id;
    return id === "ath-1" && userId === "founder" ? "FOUNDER" : null;
  };
  const service = new AthletesService(repo, noLastSeen);

  await service.requireFounderContent("founder", "ath-1");

  assert.equal(checkedCommunityId, "ath-1");
});

test("AthletesService denies non-Founders and a Founder from another Athletes community", async () => {
  const rolesByCommunity: Record<string, AthletesRole> = {
    "ath-1:moderator": "MODERATOR",
    "ath-1:member": "MEMBER",
    "ath-2:other-founder": "FOUNDER",
  };
  const repo = repositoryStub();
  repo.managerRole = async (id, userId) => rolesByCommunity[`${id}:${userId}`] ?? null;
  const service = new AthletesService(repo, noLastSeen);

  for (const userId of ["moderator", "member", "outsider", "other-founder"]) {
    await assert.rejects(
      () => service.requireFounderContent(userId, "ath-1"),
      (error: unknown) =>
        error instanceof AthletesError && error.code === "ATHLETES_FOUNDER_REQUIRED",
    );
  }
});

test("AthletesService denies Founder content when the Athletes community is archived", async () => {
  const repo = repositoryStub({ founder: "FOUNDER" });
  let roleChecked = false;
  repo.lifecycle = async () => ({ ...community(), status: "ARCHIVED" });
  repo.managerRole = async () => {
    roleChecked = true;
    return "FOUNDER";
  };
  const service = new AthletesService(repo, noLastSeen);

  await assert.rejects(
    () => service.requireFounderContent("founder", "ath-1"),
    (error: unknown) => error instanceof AthletesError && error.code === "ATHLETES_NOT_FOUND",
  );
  assert.equal(roleChecked, false);
});

test("AthletesService batches Identity last-seen only for the current member page", async () => {
  const repo = repositoryStub({ viewer: "MEMBER" });
  repo.listMembers = async (_id, input) => {
    assert.deepEqual(input, { limit: 50, cursor: "member-cursor" });
    return {
      items: [
        {
          userId: "runner-1",
          role: "MEMBER",
          joinedAt: new Date("2026-09-12T09:00:00.000Z"),
          presentation: null,
        },
        {
          userId: "runner-2",
          role: "MEMBER",
          joinedAt: new Date("2026-09-12T09:00:00.000Z"),
          presentation: null,
        },
      ],
      nextCursor: "member-next",
    };
  };
  let requestedUserIds: readonly string[] = [];
  const lastSeenReader = {
    findLastSeenByUserIds: async (userIds: readonly string[]) => {
      requestedUserIds = userIds;
      return new Map([["runner-1", new Date("2026-09-12T10:00:00.000Z")]]);
    },
  };
  const service = new AthletesService(repo, lastSeenReader);

  const page = await service.members("viewer", "ath-1", {
    limit: 50,
    cursor: "member-cursor",
  });

  assert.deepEqual(requestedUserIds, ["runner-1", "runner-2"]);
  assert.equal(page.nextCursor, "member-next");
  assert.equal(page.items[0]?.lastSeenAt, "2026-09-12T10:00:00.000Z");
  assert.equal(page.items[1]?.lastSeenAt, null);
});

test("AthletesService returns bounded manager join-request pages", async () => {
  const repo = repositoryStub({ founder: "FOUNDER" });
  repo.listJoinRequests = async (_id, input) => {
    assert.deepEqual(input, { limit: 100 });
    return {
      items: [
        {
          ...pending("runner"),
          requester: { presentation: null },
        },
      ],
      nextCursor: "request-next",
    };
  };
  const service = new AthletesService(repo, noLastSeen);

  const page = await service.joinRequests("founder", "ath-1", { limit: 100 });

  assert.equal(page.items[0]?.userId, "runner");
  assert.equal(page.nextCursor, "request-next");
});
