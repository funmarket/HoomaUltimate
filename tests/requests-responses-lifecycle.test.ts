import assert from "node:assert/strict";
import test from "node:test";
import { RequestService } from "../apps/api/src/modules/requests/application/request.service.js";
import type {
  HelpRequestRecord,
  HelpRequestResponseRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "../apps/api/src/modules/requests/application/request.repository.js";
import { RequestError } from "../apps/api/src/modules/requests/domain/request-error.js";

function requestRecord(overrides: Partial<HelpRequestRecord> = {}): HelpRequestRecord {
  return {
    id: "request-1",
    createdByUserId: "owner-1",
    publisherCommunityId: null,
    publisherTeamId: null,
    publisherAthletesCommunityId: null,
    audienceScope: "PUBLIC",
    audienceCommunityId: null,
    audienceAthletesCommunityId: null,
    category: "SERVICE",
    itemKind: null,
    sport: null,
    title: "Need help moving equipment",
    description: "Need one person to help move equipment this weekend.",
    quantityNeeded: 1,
    sizeLabel: null,
    conditionPreference: null,
    placeId: null,
    city: "Tunis",
    houma: null,
    locationNote: null,
    neededByAt: null,
    expiresAt: null,
    status: "OPEN",
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-09-17T01:00:00.000Z"),
    updatedAt: new Date("2026-09-17T01:00:00.000Z"),
    ...overrides,
  };
}

function responseRecord(overrides: Partial<HelpRequestResponseRecord> = {}): HelpRequestResponseRecord {
  return {
    id: "response-1",
    requestId: "request-1",
    responderUserId: "helper-1",
    message: "I can help Saturday.",
    status: "PENDING",
    createdAt: new Date("2026-09-17T01:05:00.000Z"),
    updatedAt: new Date("2026-09-17T01:05:00.000Z"),
    acceptedAt: null,
    declinedAt: null,
    withdrawnAt: null,
    ...overrides,
  };
}

function repository(overrides: Partial<RequestRepository> = {}): RequestRepository {
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
    async createResponse(_requestId, responderUserId, message) {
      return responseRecord({ responderUserId, message });
    },
    async listResponses() {
      return [
        responseRecord(),
        responseRecord({ id: "response-2", responderUserId: "helper-2" }),
      ];
    },
    async getResponseById() {
      return responseRecord();
    },
    async getResponseByResponder(_requestId, responderUserId) {
      return responderUserId === "helper-1" ? responseRecord() : null;
    },
    async acceptResponse() {
      return responseRecord({ status: "ACCEPTED", acceptedAt: new Date("2026-09-17T01:10:00.000Z") });
    },
    async declineResponse() {
      return responseRecord({ status: "DECLINED", declinedAt: new Date("2026-09-17T01:10:00.000Z") });
    },
    async withdrawResponse() {
      return responseRecord({ status: "WITHDRAWN", withdrawnAt: new Date("2026-09-17T01:10:00.000Z") });
    },
    async transitionRequestStatus(_id, _from, to) {
      return requestRecord({
        status: to,
        fulfilledAt: to === "FULFILLED" ? new Date("2026-09-17T01:10:00.000Z") : null,
        cancelledAt: to === "CANCELLED" ? new Date("2026-09-17T01:10:00.000Z") : null,
      });
    },
    async expireDue() {
      return 0;
    },
    ...overrides,
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

test("request managers cannot respond to their own Request", async () => {
  const service = new RequestService(repository(), visibility());
  await assert.rejects(
    service.respond("owner-1", "request-1", { message: "I can help." }),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_SELF_RESPONSE_FORBIDDEN",
  );
});

test("visible members can create one pending response and duplicates are rejected", async () => {
  const service = new RequestService(repository(), visibility());
  const created = await service.respond("helper-1", "request-1", { message: "I can help Saturday." });
  assert.equal(created.status, "PENDING");
  assert.equal(created.responderUserId, "helper-1");

  const duplicateService = new RequestService(
    repository({
      async createResponse() {
        return null;
      },
    }),
    visibility(),
  );
  await assert.rejects(
    duplicateService.respond("helper-1", "request-1", { message: "Another response" }),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_RESPONSE_ALREADY_EXISTS",
  );
});

test("response privacy gives managers all responses and authors only their own", async () => {
  const service = new RequestService(repository(), visibility());
  const manager = await service.listResponses("owner-1", "request-1");
  assert.equal(manager.items.length, 2);

  const author = await service.listResponses("helper-1", "request-1");
  assert.equal(author.items.length, 1);
  assert.equal(author.items[0]?.responderUserId, "helper-1");
});

test("current entity authority controls lifecycle management, not the historical creator", async () => {
  const entityRequest = requestRecord({
    createdByUserId: "former-manager",
    publisherCommunityId: "community-1",
  });
  const repo = repository({
    async getById() {
      return entityRequest;
    },
  });
  const service = new RequestService(
    repo,
    visibility({
      async communityRole(_communityId, userId) {
        return userId === "current-manager" ? "FOUNDER" : null;
      },
    }),
  );

  await assert.rejects(
    service.fulfill("former-manager", "request-1"),
    (error: unknown) => error instanceof RequestError && error.code === "REQUEST_MANAGE_FORBIDDEN",
  );
  const fulfilled = await service.fulfill("current-manager", "request-1");
  assert.equal(fulfilled.status, "FULFILLED");
});

test("manager acceptance and responder withdrawal use explicit terminal response states", async () => {
  const service = new RequestService(repository(), visibility());
  const accepted = await service.acceptResponse("owner-1", "request-1", "response-1");
  assert.equal(accepted.status, "ACCEPTED");

  const withdrawn = await service.withdrawResponse("helper-1", "request-1", "response-1");
  assert.equal(withdrawn.status, "WITHDRAWN");
});

test("expiry preparation delegates one atomic due-request sweep to persistence", async () => {
  let expiryAt: Date | null = null;
  const service = new RequestService(
    repository({
      async expireDue(now) {
        expiryAt = now;
        return 2;
      },
    }),
    visibility(),
  );
  const now = new Date("2026-09-17T02:00:00.000Z");
  assert.equal(await service.expireDue(now), 2);
  assert.equal(expiryAt?.toISOString(), now.toISOString());
});
