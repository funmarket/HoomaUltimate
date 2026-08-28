import type {
  ManagedPlaceSummary,
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
  PlaceSuggestionResult,
  PlaceUpdateInput,
  PublicPlaceSummary,
} from "@hooma/contracts/places";
import { request, type HoomaTransport } from "../http";

export function createPlacesApi(transport: HoomaTransport) {
  return {
    list: () => request<PublicPlaceSummary[]>(transport, "/api/public/v1/places"),
    get: (placeId: string) =>
      request<PublicPlaceSummary>(
        transport,
        `/api/public/v1/places/${encodeURIComponent(placeId)}`,
      ),
    manage: (placeId: string) =>
      request<ManagedPlaceSummary>(transport, `/api/v1/places/${encodeURIComponent(placeId)}/manage`),
    ownershipStatus: (placeId: string) =>
      request<{ verified: boolean }>(
        transport,
        `/api/v1/places/${encodeURIComponent(placeId)}/ownership-status`,
      ),
    suggest: (input: PlaceSuggestionInput) =>
      request<PlaceSuggestionResult>(transport, "/api/v1/places", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    update: (placeId: string, input: PlaceUpdateInput) =>
      request<ManagedPlaceSummary>(transport, `/api/v1/places/${encodeURIComponent(placeId)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    archive: (placeId: string) =>
      request<{ ok: true }>(transport, `/api/v1/places/${encodeURIComponent(placeId)}`, {
        method: "DELETE",
      }),
    claimOwnership: (placeId: string, input: PlaceOwnershipClaimInput) =>
      request<{ id: string; status: string }>(
        transport,
        `/api/v1/places/${encodeURIComponent(placeId)}/ownership-claims`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  };
}
