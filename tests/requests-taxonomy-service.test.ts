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
    requestType: "SPORT",
    category: "ITEM",
    itemKind: null,
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
        requestType: input.requestType ?? null,
        category: input.category,
        itemKind: input.itemKind ?? null,
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

type SelectionKind = "PRODUCT" | "COMMUNITY_ROLE" | "COMMUNITY_SUPPORT";

function taxonomy(
  kind: SelectionKind,
  allowsCustomText = false,
  requestType: "SPORT" | "COMMUNITY" = "SPORT",
) {
  const sport = requestType === "SPORT" ? ("FOOTBALL" as const) : null;
  return {
    async findActiveSelection(query: {
      requestType: "SPORT" | "COMMUNITY";
      sport: "FOOTBALL" | null;
      subcategoryId: string;
      needId: string;
    }) {
      assert.equal(query.requestType, requestType, "service must pass the request type root");
      assert.equal(query.sport, sport, "community selections must carry no sport");
      return {
        subcategory: {
          id: query.subcategoryId,
          requestType,
          sport,
          slug: "equipment-gear",
          label: "Equipment & Gear",
        },
        need: {
          id: query.needId,
          subcategoryId: query.subcategoryId,
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

const communityRequest = {
  publisher: {},
  audience: { scope: "PUBLIC" as const },
  requestType: "COMMUNITY" as const,
  subcategoryId: "hts-community-lost-found",
  needId: "htn-community-lost-found-lost-item",
  title: "Lost my wallet near the market",
  description: "Lost a brown wallet with documents near the central market yesterday.",
};

test("corrected PRODUCT creation writes compatibility fields", async () => {
  let persisted: HelpRequestCreatePersistenceInput | null = null;
  const service = new RequestService(
    repository((input) => (persisted = input)),
    visibility(),
    taxonomy("PRODUCT"),
  );

  const result = await service.create("user-1", { ...corrected, quantityNeeded: 2 });
  assert.equal(persisted?.category, "ITEM");
  assert.equal(persisted?.itemKind, null);
  assert.equal(persisted?.requestType, "SPORT");
  assert.equal(result.taxonomy?.need.kind, "PRODUCT");
  assert.equal(result.taxonomy?.requestType, "SPORT");
  assert.equal(result.taxonomy?.sportLabel, "Football");
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
  await allowed.create("user-1", { ...corrected, customNeed: "Bring training bibs" });
  assert.equal(persisted?.customNeed, "Bring training bibs");
  assert.equal(persisted?.category, "COMMUNITY");
});

test("a custom-text Need requires the requester's own words", async () => {
  const service = new RequestService(
    repository(),
    visibility(),
    taxonomy("COMMUNITY_SUPPORT", true),
  );
  await assert.rejects(
    service.create("user-1", { ...corrected }),
    (error: unknown) =>
      error instanceof RequestError && error.code === "REQUEST_CUSTOM_NEED_REQUIRED",
  );
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

test("community Requests are created without a sport and never resolve a sport label", async () => {
  let persisted: HelpRequestCreatePersistenceInput | null = null;
  const service = new RequestService(
    repository((input) => (persisted = input)),
    visibility(),
    taxonomy("COMMUNITY_SUPPORT", false, "COMMUNITY"),
  );

  const result = await service.create("user-1", communityRequest);

  assert.equal(persisted?.requestType, "COMMUNITY");
  assert.equal(persisted?.sport, null);
  assert.equal(result.taxonomy?.requestType, "COMMUNITY");
  assert.equal(result.taxonomy?.sport, null);
  assert.equal(result.taxonomy?.sportLabel, null);
});

test("a SPORT Request without a sport is rejected before the taxonomy lookup", async () => {
  let lookedUp = false;
  const service = new RequestService(repository(), visibility(), {
    async findActiveSelection() {
      lookedUp = true;
      return null;
    },
  });

  await assert.rejects(
    service.create("user-1", { ...corrected, sport: undefined }),
    (error: unknown) => error instanceof RequestError && error.code === "REQUEST_TAXONOMY_INVALID",
  );
  assert.equal(lookedUp, false);
});

test("legacy category-only Requests still persist without a taxonomy root", async () => {
  const service = new RequestService(repository(), visibility(), taxonomy("PRODUCT"));
  const legacy = await service.create("user-1", {
    publisher: {},
    audience: { scope: "PUBLIC" },
    category: "ITEM",
    itemKind: "SPORTS_GEAR",
    title: "Spare shin pads",
    description: "Spare shin pads available for a junior player this weekend.",
  });
  assert.equal(legacy.requestType, null);
  assert.equal(legacy.taxonomy, null);
  assert.equal(legacy.category, "ITEM");
});

test("a precise address is returned only to the requester who wrote the Request", async () => {
  const owned = record({ fullAddress: "12 Rue de la Plage, La Marsa", city: "La Marsa" });
  const foreign = record({ id: "request-2", createdByUserId: "user-2" });
  const addressRepository: RequestRepository = {
    ...repository(),
    async listVisibleToMember() {
      return { items: [owned, foreign], nextCursor: null };
    },
    async getVisibleToMember() {
      return owned;
    },
    async getPublic() {
      return owned;
    },
  };
  const service = new RequestService(addressRepository, visibility(), taxonomy("PRODUCT"));

  const page = await service.listForMember("user-1", { limit: 30 });
  assert.equal(page.items[0]?.fullAddress, "12 Rue de la Plage, La Marsa");
  assert.equal(page.items[1]?.fullAddress, null);

  const memberDetail = await service.getForMember("user-2", "request-1");
  assert.equal(memberDetail.fullAddress, null);

  const publicDetail = await service.getPublic("request-1");
  assert.equal(publicDetail.fullAddress, null);
  assert.equal(publicDetail.city, "La Marsa");
});
