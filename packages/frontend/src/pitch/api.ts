import type {
  PitchApplicationInput,
  PitchManagementState,
  PitchPlaceSuggestionInput,
  PitchPlaceSuggestionResult,
  PublicPitch,
} from "@hooma/contracts/pitch";
import { request, type HoomaTransport } from "../http";
import { normalizePlaceMedia } from "../places/api";

export function createPitchApi(transport: HoomaTransport) {
  return {
    list: async () =>
      (await request<PublicPitch[]>(transport, "/api/public/v1/pitch")).map((pitch) => ({
        ...pitch,
        place: normalizePlaceMedia(transport, pitch.place),
      })),
    get: async (placeId: string) => {
      const pitch = await request<PublicPitch>(
        transport,
        `/api/public/v1/pitch/${encodeURIComponent(placeId)}`,
      );
      return { ...pitch, place: normalizePlaceMedia(transport, pitch.place) };
    },
    suggestPlace: async (input: PitchPlaceSuggestionInput) => {
      const result = await request<PitchPlaceSuggestionResult>(
        transport,
        "/api/v1/pitch/suggestions",
        { method: "POST", body: JSON.stringify(input) },
      );
      return { ...result, place: normalizePlaceMedia(transport, result.place) };
    },
    manage: async (placeId: string) => {
      const state = await request<PitchManagementState>(
        transport,
        `/api/v1/pitch/${encodeURIComponent(placeId)}/manage`,
      );
      return { ...state, place: normalizePlaceMedia(transport, state.place) };
    },
    submitRevision: (placeId: string, input: PitchApplicationInput) =>
      request<{ id: string; status: string }>(
        transport,
        `/api/v1/pitch/${encodeURIComponent(placeId)}/applications`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  };
}
