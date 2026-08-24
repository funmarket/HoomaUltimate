import type { DiscoveryNowResponse } from "@hooma/contracts/discovery";
import { request, type HoomaTransport } from "../http";

export function createDiscoveryApi(transport: HoomaTransport) {
  return {
    now: (limit = 30, focusCommunityId?: string) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (focusCommunityId) params.set("communityId", focusCommunityId);
      return request<DiscoveryNowResponse>(transport, `/api/public/v1/discovery/now?${params}`);
    },
  };
}
