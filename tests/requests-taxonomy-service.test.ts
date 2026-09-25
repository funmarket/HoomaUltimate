import assert from "node:assert/strict";
import test from "node:test";
import type {
  HelpRequestCreatePersistenceInput,
  HelpRequestRecord,
  RequestRepository,
  RequestVisibilityReader,
} from "../apps/api/src/modules/requests/application/request.repository.js";
import { RequestService } from "../apps/api/src/modules/requests/application/request.service.js";
import { RequestError } from "../apps/api/src/modules/requests/domain/request-error.js";

function record(overrides: Partial<HelpRequestRecord> = {}): HelpRequestRecord {
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
    itemKind: null,
    requestType: "SPORT",
    sport: "FOOTBALL",
    subcategoryId: "hts-football-equipment",
    needId: "htn-football-ball",
    customNeed: null,
    taxonomySubcategory: {
      id: "hts-football-equipment",
      slug: "equipment-gear",
      label: "Equipment & Gear",
    },
    taxonomyNeed: {
      id: "htn-football-ball",
      slug: "football",
      label: "Football",
      kind: "PRODUCT",
      allowsCustomText: false,
    },
    title: "Need a football",
    description: "Looking for a football for a local training session.",
    quantityNeeded: 1,
    sizeLabel: null,
    conditionPreference: null,
    placeId: null,
    city: null,
    houma: null,
    fullAddress: null,
    locationNote: null,
    neededByAt: null,
    expiresAt: null,
    status: "OPEN",
    fulfilledAt: null,
    cancelledAt: null,
    createdAt: new Date("2026-09-22T00:00:00.000Z"),
    updatedAt: new Date("2026-09-22T00:00:00.000Z"),
    ...overrides,
  };
}

function repository(
  onCreate?: (input: HelpRequestCreatePersistenceInput) => void,
): RequestRepository {
  return {
    async create(_userId, input) {
      onCreate?.(input);
      return record({
        category: input.category,
        itemKind: input.itemKind ?? null,
        requestType: input.requestType ?? null,
        sport: input.sport ?? null,
        subcategoryId: input.subcategoryId ?? null,
        needId: input.needId ?? null,
        customNeed: input.customNeed ?? null,
        fullAddress: input.fullAddress ?? null,
      });
    },
    async listPublic() {
      return { items: [], nextCursor: null };
    },
    async getPublic() {
      return null;
    },
    async listVisibleToMember() {
      return { items: [], nextCursor: null };
    },
    async getVisibleToMember() {
      return null;
    },
    async getById() {
      return null;
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

function visibility(): RequestVisibilityReader {
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
  };
}

function taxonomy(
  kind: "PRODUCT" | "COMMUNITY_ROLE" | "COMMUNITY_SUPPORT",
  allowsCustomText = false,
  requestType: "SPORT" | "COMMUNITY" = "SPORT",
) {
  return {
    async findActiveSelection() {
      return {
        subcategory: {
          id: requestType === "SPORT" ? "hts-football-equipment" : "hts-community-lost-found",
          requestType,
          sport: requestType === "SPORT" ? ("FOOTBALL" as const) : null,
          slug: "equipment-gear",
          label: "Equipment & Gear",
        },
        need: {
          id: "htn-football-ball",
          subcategoryId: "hts-football-equipment",
          slug: "football",
          label: "Football",
          kind,
          allowsCustomText,
        },
      };
    },
  };
}

const corrected = {
  publisher: {},
  audience: { scope: "PUBLIC" as const },
  requestType: "SPORT" as const,
  sport: "FOOTBALL" as const,
  subcategoryId: "hts-football-equipment",
  needId: "htn-football-ball",
  title: "Need a football",
  description: "Looking for a football for a local training session.",
};

test("corrected PRODUCT creation writes compatibility fields", async () => {
  let persisted: HelpRequestCreatePersistenceInput | null = null;
  const service = new RequestService(
    repository((input) => (persisted = input)),
    visibility(),
    taxonomy("PRODUCT"),
  );

  const result = await service.create("user-1", {
    ...corrected,
    quantityNeeded: 2,
    fullAddress: "12 Avenue Habib Bourguiba",
  });
  assert.equal(persisted?.requestType, "SPORT");
  assert.equal(persisted?.category, "ITEM");
  assert.equal(persisted?.itemKind, null);
  assert.equal(persisted?.fullAddress, "12 Avenue Habib Bourguiba");
  assert.equal("fullAddress" in result, false);
  assert.equal(result.taxonomy?.need.kind, "PRODUCT");
});

test("Community Requests validate through the same canonical taxonomy reader without Sport", async () => {
  let persisted: HelpRequestCreatePersistenceInput | null = null;
  const service = new RequestService(
    repository((input) => (persisted = input)),
    visibility(),
    taxonomy("COMMUNITY_SUPPORT", false, "COMMUNITY"),
  );
  await service.create("user-1", {
    publisher: {},
    audience: { scope: "PUBLIC" },
    requestType: "COMMUNITY",
    subcategoryId: "hts-community-lost-found",
    needId: "htn-community-lost-item",
    title: "Lost wallet near the station",
    description: "I lost a wallet nearby and need help checking the area.",
  });
  assert.equal(persisted?.requestType, "COMMUNITY");
  assert.equal(persisted?.sport, null);
  assert.equal(persisted?.category, "COMMUNITY");
});

test("community role/support Needs reject product metadata", async () => {
  const service = new RequestService(repository(), visibility(), taxonomy("COMMUNITY_ROLE"));
  await assert.rejects(
    service.create("user-1", { ...corrected, quantityNeeded: 1 }),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_PRODUCT_METADATA_FORBIDDEN",
  );
});

test("customNeed is accepted only when the selected Need allows custom text", async () => {
  const denied = new RequestService(
    repository(),
    visibility(),
    taxonomy("COMMUNITY_SUPPORT", false),
  );
  await assert.rejects(
    denied.create("user-1", { ...corrected, customNeed: "Bring training bibs" }),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_CUSTOM_NEED_FORBIDDEN",
  );

  let persisted: HelpRequestCreatePersistenceInput | null = null;
  const allowed = new RequestService(
    repository((input) => (persisted = input)),
    visibility(),
    taxonomy("COMMUNITY_SUPPORT", true),
  );
  await assert.rejects(
    allowed.create("user-1", corrected),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_CUSTOM_NEED_REQUIRED",
  );
  await allowed.create("user-1", { ...corrected, customNeed: "Bring training bibs" });
  assert.equal(persisted?.customNeed, "Bring training bibs");
  assert.equal(persisted?.category, "COMMUNITY");
});

test("invalid or inactive taxonomy selections are rejected before persistence", async () => {
  let created = false;
  const taxonomyReader = {
    async findActiveSelection() {
      return null;
    },
  };
  const service = new RequestService(
    repository(() => {
      created = true;
    }),
    visibility(),
    taxonomyReader,
  );

  await assert.rejects(
    service.create("user-1", corrected),
    (error: unknown) => error instanceof RequestError && error.code === "REQUEST_TAXONOMY_INVALID",
  );
  assert.equal(created, false);
});
