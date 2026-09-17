import assert from "node:assert/strict";
import test from "node:test";
import { RequestService } from "../apps/api/src/modules/requests/application/request.service.js";
import type {
  HelpRequestRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "../apps/api/src/modules/requests/application/request.repository.js";
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
    title: "Need running shoes",
    description: "Looking for size 43 running shoes for training.",
    quantityNeeded: 1,
    sizeLabel: "43",
    conditionPreference: "USED_OK",
    placeId: null,
    city: "Tunis",
    houma: "La Marsa",
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
