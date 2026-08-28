import type {
  PitchManagementState,
  PlaceCapabilityApplicationInput,
  PublicPlaceCapability,
} from "@hooma/contracts/pitch";
import { request, type HoomaTransport } from "../http";

export function createPitchApi(transport: HoomaTransport) {
  return {
    list: () => request<PublicPlaceCapability[]>(transport, "/api/public/v1/pitch"),
    get: (placeId: string) =>
      request<PublicPlaceCapability>(
        transport,
        `/api/public/v1/pitch/${encodeURIComponent(placeId)}`,
      ),
    manage: (placeId: string) =>
      request<PitchManagementState>(
        transport,
        `/api/v1/pitch/${encodeURIComponent(placeId)}/manage`,
      ),
    submit: (placeId: string, input: PlaceCapabilityApplicationInput) =>
      request<{ id: string; status: string }>(transport, "/api/v1/pitch/applications", {
        method: "POST",
        body: JSON.stringify({ placeId, ...input }),
      }),
  };
}
