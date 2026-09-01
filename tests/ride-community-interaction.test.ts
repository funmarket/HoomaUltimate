import assert from "node:assert/strict";
import test from "node:test";
import { RideCommunityInteractionService } from "../apps/api/src/modules/rides/application/ride-community-interaction.service.js";
import type { RideCommunityInteractionRepository } from "../apps/api/src/modules/rides/application/ride-community-interaction.repository.js";
import type { RideCommunityMembershipReader } from "../apps/api/src/modules/rides/application/ride-community-membership.reader.js";
import type { UserPresentationReader } from "../apps/api/src/modules/identity/application/user-presentation.reader.js";

function serviceFor(input: {
  readonly viewerIsMember?: boolean;
  readonly requesterUserId?: string | null;
}) {
  const repository: RideCommunityInteractionRepository = {
    async getActiveCommunityRequest() {
      return input.requesterUserId ? { requesterUserId: input.requesterUserId } : null;
    },
  };
  const memberships: RideCommunityMembershipReader = {
    async listActiveMembershipCommunities() {
      return [];
    },
    async isActiveMemberOfCommunity() {
      return input.viewerIsMember ?? true;
    },
  };
  const presentations: UserPresentationReader = {
    async findByUserIds(userIds) {
      return userIds.map((userId) => ({
        userId,
        displayName: "Ride Requester",
        username: "ride-requester",
        photoUrl: null,
      }));
    },
  };
  return new RideCommunityInteractionService(repository, memberships, presentations);
}

test("community Ride interaction returns canonical requester presentation", async () => {
  const service = serviceFor({ requesterUserId: "requester-1" });
  const result = await service.getRequestInteraction("viewer-1", "community-1", "request-1");

  assert.equal(result.requestId, "request-1");
  assert.deepEqual(result.requester, {
    displayName: "Ride Requester",
    username: "ride-requester",
    photoUrl: null,
  });
  assert.equal(result.canWhistle, true);
});

test("community Ride interaction prevents Whistling yourself", async () => {
  const service = serviceFor({ requesterUserId: "viewer-1" });
  const result = await service.getRequestInteraction("viewer-1", "community-1", "request-1");
  assert.equal(result.canWhistle, false);
});

test("community Ride interaction requires active viewer membership", async () => {
  const service = serviceFor({ viewerIsMember: false, requesterUserId: "requester-1" });
  await assert.rejects(
    () => service.getRequestInteraction("viewer-1", "community-1", "request-1"),
    (error: unknown) =>
      error instanceof Error &&
      "code" in error &&
      error.code === "RIDE_REQUEST_COMMUNITY_FEED_FORBIDDEN",
  );
});

test("community Ride interaction hides inactive or unrelated requests", async () => {
  const service = serviceFor({ requesterUserId: null });
  await assert.rejects(
    () => service.getRequestInteraction("viewer-1", "community-1", "request-1"),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "RIDE_REQUEST_NOT_FOUND",
  );
});
