import type { RideRequestCommunityInteraction } from "@hooma/contracts/ride-community-interaction";
import { request, type HoomaTransport } from "../http";

export function getRideRequestCommunityInteraction(
  transport: HoomaTransport,
  communityId: string,
  requestId: string,
) {
  return request<RideRequestCommunityInteraction>(
    transport,
    `/api/v1/rides/communities/${encodeURIComponent(communityId)}/requests/${encodeURIComponent(
      requestId,
    )}/interaction`,
  );
}
