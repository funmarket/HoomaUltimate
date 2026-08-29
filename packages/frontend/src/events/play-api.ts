import type {
  PlayEventInviteInput,
  PlayLookingFor,
  PlayPlayerListingInput,
  PlayTeamOfferInput,
} from "@hooma/contracts/play";
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

export type PlayActionState = {
  teamOffers: { offerId: string; teamId: string; listingId: string }[];
  eventInvites: { inviteId: string; eventId: string; listingId: string }[];
};

export type ManagedPlayEvent = {
  id: string;
  title: string;
  startsAt: string;
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
    actionState: () => request<PlayActionState>(transport, "/api/v1/play/player-actions"),
    managedEvents: () => request<ManagedPlayEvent[]>(transport, "/api/v1/play/managed-events"),
    sendTeamOffer: (listingId: string, input: PlayTeamOfferInput) =>
      request(
        transport,
        `/api/v1/play/player-listings/${encodeURIComponent(listingId)}/team-offer`,
        { method: "POST", body: JSON.stringify(input) },
      ),
    sendEventInvite: (listingId: string, input: PlayEventInviteInput) =>
      request(
        transport,
        `/api/v1/play/player-listings/${encodeURIComponent(listingId)}/event-invite`,
        { method: "POST", body: JSON.stringify(input) },
      ),
  };
}
