import type { RideRequestCommunityInteraction } from "@hooma/contracts/ride-community-interaction";
import type { UserPresentationReader } from "../../identity/application/user-presentation.reader.js";
import type { RideCommunityMembershipReader } from "./ride-community-membership.reader.js";
import type { RideCommunityInteractionRepository } from "./ride-community-interaction.repository.js";
import { RideError } from "../domain/ride-error.js";

export class RideCommunityInteractionService {
  constructor(
    private readonly repository: RideCommunityInteractionRepository,
    private readonly communityMemberships: RideCommunityMembershipReader,
    private readonly userPresentations: UserPresentationReader,
  ) {}

  async getRequestInteraction(
    viewerUserId: string,
    communityId: string,
    requestId: string,
  ): Promise<RideRequestCommunityInteraction> {
    const canView = await this.communityMemberships.isActiveMemberOfCommunity(
      viewerUserId,
      communityId,
    );
    if (!canView) {
      throw new RideError(
        "RIDE_REQUEST_COMMUNITY_FEED_FORBIDDEN",
        "Community Ride requests are visible only to active HOOMA members",
      );
    }

    const record = await this.repository.getActiveCommunityRequest({ communityId, requestId });
    if (!record) {
      throw new RideError("RIDE_REQUEST_NOT_FOUND", "Ride request not found");
    }

    const presentations = await this.userPresentations.findByUserIds([record.requesterUserId]);
    const requester = presentations[0] ?? null;

    return {
      requestId,
      requester: requester
        ? {
            displayName: requester.displayName,
            username: requester.username,
            photoUrl: requester.photoUrl,
          }
        : null,
      canWhistle: record.requesterUserId !== viewerUserId,
    };
  }
}
