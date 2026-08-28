import type {
  PitchApplicationInput,
  PitchManagementState,
  PitchPlaceSuggestionInput,
  PitchPlaceSuggestionResult,
  PublicPitch,
} from "@hooma/contracts/pitch";
import { request, type HoomaTransport } from "../http";

export function createPitchApi(transport: HoomaTransport) {
  return {
    list: () => request<PublicPitch[]>(transport, "/api/public/v1/pitch"),
    get: (placeId: string) =>
      request<PublicPitch>(transport, `/api/public/v1/pitch/${encodeURIComponent(placeId)}`),
    suggestPlace: (input: PitchPlaceSuggestionInput) =>
      request<PitchPlaceSuggestionResult>(transport, "/api/v1/pitch/suggestions", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    manage: (placeId: string) =>
      request<PitchManagementState>(
        transport,
        `/api/v1/pitch/${encodeURIComponent(placeId)}/manage`,
      ),
    submitRevision: (placeId: string, input: PitchApplicationInput) =>
      request<{ id: string; status: string }>(
        transport,
        `/api/v1/pitch/${encodeURIComponent(placeId)}/applications`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  };
}
