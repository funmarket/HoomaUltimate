import assert from "node:assert/strict";
import test from "node:test";
import { RequestService } from "../apps/api/src/modules/requests/application/request.service.js";
import type {
  HelpRequestRecord,
  HelpRequestResponseRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "../apps/api/src/modules/requests/application/request.repository.js";
import type { UserPresentationReader } from "../apps/api/src/modules/identity/application/user-presentation.reader.js";
import { RequestError } from "../apps/api/src/modules/requests/domain/request-error.js";

function requestRecord(overrides: Partial<HelpRequestRecord> = {}): HelpRequestRecord {
  return {
    id: "request-1",
    createdByUserId: "user-1",
    publisherCommunityId: null,
    publisherTeamId: null,
    publisherAthletesCommunityId: null,
    audienceScope: "PUBLIC",
    audienceCommunityId: null,
    audienceAthletesCommunityId: null,
    category: "ITEM",
    itemKind: "FOOTWEAR",
    sport: "RUNNING",
    subcategoryId: null,
    needId: null,
    customNeed: null,
    taxonomySubcategory: null,
    taxonomyNeed: null,
    title: "Need running shoes",
    description: "Looking for size 43 running shoes for training.",
    quantityNeeded: 1,
    sizeLabel: "43",
    conditionPreference: "USED_OK",
    placeId: null,
    city: "Tunis",
    houma: "La Marsa",
    fullAddress: "12 Private Street",
    locationNote: null,
    neededByAt: null,
    expiresAt: null,
    status: "OPEN",
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-09-17T00:00:00.000Z"),
    updatedAt: new Date("2026-09-17T00:00:00.000Z"),
    ...overrides,
  };
}

test("Request list and detail projections omit fullAddress from every read path", async () => {
  const service = new RequestService(repository(), visibility());

  const publicPage = await service.listPublic({ limit: 30 });
  const memberPage = await service.listForMember("user-1", { limit: 30 });
  const publicDetail = await service.getPublic("request-1");
  const memberDetail = await service.getForMember("user-1", "request-1");

  for (const item of [publicPage.items[0], memberPage.items[0], publicDetail, memberDetail]) {
    assert.equal(Boolean(item && "fullAddress" in item), false);
  }
});

function responseRecord(
  overrides: Partial<HelpRequestResponseRecord> = {},
): HelpRequestResponseRecord {
  return {
    id: "response-1",
    requestId: "request-1",
    responderUserId: "user-2",
    message: "I can help.",
    status: "PENDING",
    createdAt: new Date("2026-09-17T01:00:00.000Z"),
    updatedAt: new Date("2026-09-17T01:00:00.000Z"),
    acceptedAt: null,
    declinedAt: null,
    withdrawnAt: null,
    ...overrides,
  };
}

function repository(): RequestRepository {
  return {
    async create() {
      return requestRecord();
    },
    async listPublic() {
      return { items: [requestRecord()], nextCursor: null };
    },
    async getPublic() {
      return requestRecord();
    },
    async listVisibleToMember() {
      return { items: [requestRecord()], nextCursor: null };
    },
    async getVisibleToMember() {
      return requestRecord();
    },
    async getById() {
      return requestRecord();
    },
    async createResponse() {
      return null;
    },
    async listResponses() {
      return [];
    },
    async getResponseById() {
      return null;
    },
    async getResponseByResponder() {
      return null;
    },
    async acceptResponse() {
      return null;
    },
    async declineResponse() {
      return null;
    },
    async withdrawResponse() {
      return null;
    },
    async transitionRequestStatus() {
      return null;
    },
    async expireDue() {
      return 0;
    },
  };
}

function visibility(overrides: Partial<RequestVisibilityReader> = {}): RequestVisibilityReader {
  return {
    async communityRole() {
      return null;
    },
    async teamResponsibility() {
      return null;
    },
    async athletesRole() {
      return null;
    },
    async isCommunityMember() {
      return false;
    },
    async isAthletesMember() {
      return false;
    },
    ...overrides,
  };
}

const personalInput = {
  publisher: {},
  audience: { scope: "PUBLIC" as const },
  category: "ITEM" as const,
  itemKind: "FOOTWEAR" as const,
  title: "Need running shoes",
  description: "Looking for size 43 running shoes for training.",
};

test("Requests allow personal publishing for any authenticated user", async () => {
  const service = new RequestService(repository(), visibility());
  const created = await service.create("user-1", personalInput);
  assert.equal(created.id, "request-1");
});

test("Requests require current HOOMA Founder or Coach authority for official publishing", async () => {
  const service = new RequestService(
    repository(),
    visibility({
      async communityRole() {
        return "MEMBER";
      },
    }),
  );
  await assert.rejects(
    service.create("user-1", {
      ...personalInput,
      publisher: { publisherCommunityId: "community-1" },
    }),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_COMMUNITY_PUBLISHER_FORBIDDEN",
  );
});

test("Requests require current Team Coach responsibility and reject Assistant-only authority", async () => {
  const service = new RequestService(
    repository(),
    visibility({
      async teamResponsibility() {
        return "ASSISTANT";
      },
    }),
  );
  await assert.rejects(
    service.create("user-1", {
      ...personalInput,
      publisher: { publisherTeamId: "team-1" },
    }),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_TEAM_PUBLISHER_FORBIDDEN",
  );
});

test("Requests allow Athletes Founder or Moderator official publishing", async () => {
  let created = false;
  const repo = repository();
  const service = new RequestService(
    {
      ...repo,
      async create() {
        created = true;
        return requestRecord({ publisherAthletesCommunityId: "athletes-1" });
      },
    },
    visibility({
      async athletesRole() {
        return "MODERATOR";
      },
    }),
  );

  const result = await service.create("user-1", {
    ...personalInput,
    publisher: { publisherAthletesCommunityId: "athletes-1" },
  });
  assert.equal(created, true);
  assert.equal(result.publisherAthletesCommunityId, "athletes-1");
});

test("Requests hide private scoped objects from nonmembers with not-found semantics", async () => {
  const service = new RequestService(
    {
      ...repository(),
      async getVisibleToMember() {
        return null;
      },
    },
    visibility(),
  );

  await assert.rejects(
    service.getForMember("outsider", "private-request"),
    (error: unknown) => error instanceof RequestError && error.code === "REQUEST_NOT_FOUND",
  );
});

test("Request list requester presentation is one deduplicated Identity batch read", async () => {
  const calls: string[][] = [];
  const presentations: UserPresentationReader = {
    async findByUserIds(userIds) {
      calls.push([...userIds]);
      return [
        {
          userId: "user-1",
          displayName: "Amine",
          username: "amine",
          photoUrl: "https://cdn.example.test/amine.jpg",
        },
        {
          userId: "user-2",
          displayName: "Bashir",
          username: "bashir",
          photoUrl: null,
        },
      ];
    },
  };
  const repo = repository();
  const service = new RequestService(
    {
      ...repo,
      async listPublic() {
        return {
          items: [
            requestRecord({ id: "request-1", createdByUserId: "user-1" }),
            requestRecord({ id: "request-2", createdByUserId: "user-1" }),
            requestRecord({ id: "request-3", createdByUserId: "user-2" }),
          ],
          nextCursor: null,
        };
      },
    },
    visibility(),
    undefined,
    presentations,
  );

  const page = await service.listPublic({ limit: 30 });

  assert.deepEqual(calls, [["user-1", "user-2"]]);
  assert.deepEqual(page.items[0]?.requester, {
    displayName: "Amine",
    username: "amine",
    photoUrl: "https://cdn.example.test/amine.jpg",
  });
  assert.deepEqual(page.items[1]?.requester, page.items[0]?.requester);
  assert.deepEqual(page.items[2]?.requester, {
    displayName: "Bashir",
    username: "bashir",
    photoUrl: null,
  });
  assert.equal(
    page.items.some((item) => item.requester && "userId" in item.requester),
    false,
    "Request DTO must expose only safe requester presentation fields",
  );
});

test("Request detail resolves its creator through the canonical Identity reader once", async () => {
  const calls: string[][] = [];
  const presentations: UserPresentationReader = {
    async findByUserIds(userIds) {
      calls.push([...userIds]);
      return [
        {
          userId: "user-2",
          displayName: "Bashir",
          username: "bashir",
          photoUrl: null,
        },
      ];
    },
  };
  const repo = repository();
  const service = new RequestService(
    {
      ...repo,
      async getPublic() {
        return requestRecord({ createdByUserId: "user-2" });
      },
    },
    visibility(),
    undefined,
    presentations,
  );

  const item = await service.getPublic("request-1");

  assert.deepEqual(calls, [["user-2"]]);
  assert.deepEqual(item.requester, {
    displayName: "Bashir",
    username: "bashir",
    photoUrl: null,
  });
});

test("Request response lists batch responder presentation through canonical Identity", async () => {
  const calls: string[][] = [];
  const presentations: UserPresentationReader = {
    async findByUserIds(userIds) {
      calls.push([...userIds]);
      return [
        {
          userId: "user-2",
          displayName: "Bashir",
          username: "bashir",
          photoUrl: "https://cdn.example.test/bashir.jpg",
        },
        {
          userId: "user-3",
          displayName: "Amine",
          username: "amine",
          photoUrl: null,
        },
      ];
    },
  };
  const repo = repository();
  const service = new RequestService(
    {
      ...repo,
      async listResponses() {
        return [
          responseRecord({ id: "response-1", responderUserId: "user-2" }),
          responseRecord({ id: "response-2", responderUserId: "user-2" }),
          responseRecord({ id: "response-3", responderUserId: "user-3" }),
        ];
      },
    },
    visibility(),
    undefined,
    presentations,
  );

  const page = await service.listResponses("user-1", "request-1");
  const responders = page.items.map(
    (item) => (item as unknown as { responder?: unknown }).responder,
  );

  assert.deepEqual(calls, [["user-2", "user-3"]]);
  assert.deepEqual(responders, [
    {
      displayName: "Bashir",
      username: "bashir",
      photoUrl: "https://cdn.example.test/bashir.jpg",
    },
    {
      displayName: "Bashir",
      username: "bashir",
      photoUrl: "https://cdn.example.test/bashir.jpg",
    },
    {
      displayName: "Amine",
      username: "amine",
      photoUrl: null,
    },
  ]);
  assert.equal(
    responders.some((responder) => Boolean(responder && "userId" in (responder as object))),
    false,
  );
});

test("Request response mutations preserve responder presentation", async () => {
  const calls: string[][] = [];
  const presentations: UserPresentationReader = {
    async findByUserIds(userIds) {
      calls.push([...userIds]);
      return [
        {
          userId: "user-2",
          displayName: "Bashir",
          username: "bashir",
          photoUrl: null,
        },
      ];
    },
  };
  const repo = repository();
  const service = new RequestService(
    {
      ...repo,
      async createResponse() {
        return responseRecord();
      },
      async acceptResponse() {
        return responseRecord({
          status: "ACCEPTED",
          acceptedAt: new Date("2026-09-17T03:00:00.000Z"),
        });
      },
      async declineResponse() {
        return responseRecord({
          status: "DECLINED",
          declinedAt: new Date("2026-09-17T03:05:00.000Z"),
        });
      },
      async getResponseById() {
        return responseRecord();
      },
      async withdrawResponse() {
        return responseRecord({
          status: "WITHDRAWN",
          withdrawnAt: new Date("2026-09-17T03:10:00.000Z"),
        });
      },
    },
    visibility(),
    undefined,
    presentations,
  );

  const created = await service.respond("user-2", "request-1", { message: "I can help." });
  const accepted = await service.acceptResponse("user-1", "request-1", "response-1");
  const declined = await service.declineResponse("user-1", "request-1", "response-1");
  const withdrawn = await service.withdrawResponse("user-2", "request-1", "response-1");

  assert.deepEqual(calls, [["user-2"], ["user-2"], ["user-2"], ["user-2"]]);
  for (const response of [created, accepted, declined, withdrawn]) {
    assert.deepEqual(response.responder, {
      displayName: "Bashir",
      username: "bashir",
      photoUrl: null,
    });
  }
});
