import type { DiscoveryNowResponse } from "@hooma/contracts/discovery";
import { request, type HoomaTransport } from "../http";

export function createDiscoveryApi(transport: HoomaTransport) {
  return {
    now: (limit = 30) =>
      request<DiscoveryNowResponse>(
        transport,
        `/api/public/v1/discovery/now?limit=${encodeURIComponent(String(limit))}`,
      ),
  };
}
