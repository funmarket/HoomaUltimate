import type { PlayLookingFor, PlayPlayerListingInput } from "@hooma/contracts/play";
import { request, type HoomaTransport } from "../http";

export type PublicPlayPlayerListing = {
  id: string;
  lookingFor: PlayLookingFor;
  updatedAt: string;
  presentation: {
    username: string;
    displayName: string;
    photoUrl: string | null;
    bio: string | null;
  } | null;
};

export type MyPlayPlayerListing = {
  id: string;
  lookingFor: PlayLookingFor;
  createdAt: string;
  updatedAt: string;
};

export function createPlayApi(transport: HoomaTransport) {
  return {
    publicPlayerListings: () =>
      request<{ items: PublicPlayPlayerListing[] }>(
        transport,
        "/api/public/v1/play/player-listings?limit=30",
      ),
    myPlayerListing: () =>
      request<MyPlayPlayerListing | null>(transport, "/api/v1/play/player-listing"),
    savePlayerListing: (input: PlayPlayerListingInput) =>
      request<MyPlayPlayerListing>(transport, "/api/v1/play/player-listing", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    removePlayerListing: () =>
      request<{ removed: boolean }>(transport, "/api/v1/play/player-listing", {
        method: "DELETE",
      }),
  };
}
