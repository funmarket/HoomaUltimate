import type {
  PublicRideOffer,
  PublicRideOfferList,
  PublicRideRequest,
  PublicRideRequestList,
  RideMeetingPoint,
  RideMeetingPointInput,
  RideMine,
  RideContext,
  RideOfferCreateInput,
  RideOfferForOwner,
  RideParticipation,
  RideParticipationRequestInput,
  RideRequestCommunityFeed,
  RideRequestCreateInput,
  RideRequestForOwner,
} from "@hooma/contracts/rides";
import { request, type HoomaTransport } from "../http";

export type {
  PublicRideOffer,
  PublicRideRequest,
  RideMeetingPoint,
  RideMine,
  RideOfferCreateInput,
  RideOfferForOwner,
  RideParticipation,
  RideRequestCommunityFeed,
  RideRequestCreateInput,
  RideRequestForOwner,
};

export type RideListQuery = {
  readonly cursor?: string;
  readonly context?: RideContext;
  readonly eventId?: string;
  readonly destinationPlaceId?: string;
  readonly from?: string;
  readonly limit?: number;
};

export type RideMineQuery = {
  readonly limit?: number;
  readonly offerCursor?: string;
  readonly requestCursor?: string;
  readonly participationCursor?: string;
};

export type RideVehiclePhotoMetadata = {
  readonly id: string;
  readonly rideOfferId: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function listPath(kind: "offers" | "requests", query: RideListQuery = {}): string {
  const params = new URLSearchParams({ limit: String(query.limit ?? 20) });
  if (query.cursor) params.set("cursor", query.cursor);
  if (query.context) params.set("context", query.context);
  if (query.eventId) params.set("eventId", query.eventId);
  if (query.destinationPlaceId) params.set("destinationPlaceId", query.destinationPlaceId);
  if (query.from) params.set("from", query.from);
  return `/api/public/v1/rides/${kind}?${params.toString()}`;
}

function minePath(query: RideMineQuery = {}): string {
  const params = new URLSearchParams({ limit: String(query.limit ?? 20) });
  if (query.offerCursor) params.set("offerCursor", query.offerCursor);
  if (query.requestCursor) params.set("requestCursor", query.requestCursor);
  if (query.participationCursor) params.set("participationCursor", query.participationCursor);
  return ridePath(`/mine?${params.toString()}`);
}

function ridePath(path: string): string {
  return `/api/v1/rides${path}`;
}

function publicRidePath(path: string): string {
  return `/api/public/v1/rides${path}`;
}

export function createRideApi(transport: HoomaTransport) {
  return {
    listOffers: (query?: RideListQuery) =>
      request<PublicRideOfferList>(transport, listPath("offers", query)),
    getOffer: (offerId: string) =>
      request<PublicRideOffer>(transport, publicRidePath(`/offers/${encodeURIComponent(offerId)}`)),
    getMyRides: (query?: RideMineQuery) => request<RideMine>(transport, minePath(query)),
    manageOffer: (offerId: string) =>
      request<RideOfferForOwner>(
        transport,
        ridePath(`/offers/${encodeURIComponent(offerId)}/manage`),
      ),
    createOffer: (input: RideOfferCreateInput) =>
      request<RideOfferForOwner>(transport, ridePath("/offers"), {
        method: "POST",
        body: JSON.stringify(input),
      }),
    cancelOffer: (offerId: string) =>
      request<RideOfferForOwner>(
        transport,
        ridePath(`/offers/${encodeURIComponent(offerId)}/cancel`),
        { method: "POST" },
      ),
    requestParticipation: (offerId: string, input: RideParticipationRequestInput) =>
      request<RideParticipation>(
        transport,
        ridePath(`/offers/${encodeURIComponent(offerId)}/participations`),
        {
          method: "POST",
          body: JSON.stringify(input),
        },
      ),
    getMyParticipation: (offerId: string) =>
      request<RideParticipation>(
        transport,
        ridePath(`/offers/${encodeURIComponent(offerId)}/participations/me`),
      ),
    acceptParticipation: (offerId: string, participationId: string) =>
      request<RideParticipation>(
        transport,
        ridePath(
          `/offers/${encodeURIComponent(offerId)}/participations/${encodeURIComponent(
            participationId,
          )}/accept`,
        ),
        { method: "POST" },
      ),
    rejectParticipation: (offerId: string, participationId: string) =>
      request<RideParticipation>(
        transport,
        ridePath(
          `/offers/${encodeURIComponent(offerId)}/participations/${encodeURIComponent(
            participationId,
          )}/reject`,
        ),
        { method: "POST" },
      ),
    cancelParticipation: (offerId: string, participationId: string) =>
      request<RideParticipation>(
        transport,
        ridePath(
          `/offers/${encodeURIComponent(offerId)}/participations/${encodeURIComponent(
            participationId,
          )}/cancel`,
        ),
        { method: "POST" },
      ),
    setMeetingPoint: (offerId: string, participationId: string, input: RideMeetingPointInput) =>
      request<RideMeetingPoint>(
        transport,
        ridePath(
          `/offers/${encodeURIComponent(offerId)}/participations/${encodeURIComponent(
            participationId,
          )}/meeting-point`,
        ),
        {
          method: "PUT",
          body: JSON.stringify(input),
        },
      ),
    getMeetingPoint: (participationId: string) =>
      request<RideMeetingPoint>(
        transport,
        ridePath(`/participations/${encodeURIComponent(participationId)}/meeting-point`),
      ),
    replaceOfferVehiclePhoto: (offerId: string, file: File) =>
      request<RideVehiclePhotoMetadata>(
        transport,
        ridePath(`/offers/${encodeURIComponent(offerId)}/photo`),
        {
          method: "PUT",
          headers: { "content-type": file.type || "application/octet-stream" },
          body: file,
        },
      ),
    deleteOfferVehiclePhoto: (offerId: string) =>
      request<Record<string, never>>(
        transport,
        ridePath(`/offers/${encodeURIComponent(offerId)}/photo`),
        { method: "DELETE" },
      ),
    offerPhotoUrl: (offerId: string) =>
      `${transport.baseUrl}${publicRidePath(`/offers/${encodeURIComponent(offerId)}/photo`)}`,
    listRequests: (query?: RideListQuery) =>
      request<PublicRideRequestList>(transport, listPath("requests", query)),
    listCommunityRequests: (communityId: string, query?: RideListQuery) =>
      request<RideRequestCommunityFeed>(
        transport,
        ridePath(
          `/communities/${encodeURIComponent(communityId)}/requests?${new URLSearchParams({
            limit: String(query?.limit ?? 20),
            ...(query?.cursor ? { cursor: query.cursor } : {}),
          }).toString()}`,
        ),
      ),
    getRequest: (requestId: string) =>
      request<PublicRideRequest>(
        transport,
        publicRidePath(`/requests/${encodeURIComponent(requestId)}`),
      ),
    manageRequest: (requestId: string) =>
      request<RideRequestForOwner>(
        transport,
        ridePath(`/requests/${encodeURIComponent(requestId)}/manage`),
      ),
    createRequest: (input: RideRequestCreateInput) =>
      request<RideRequestForOwner>(transport, ridePath("/requests"), {
        method: "POST",
        body: JSON.stringify(input),
      }),
    cancelRequest: (requestId: string) =>
      request<RideRequestForOwner>(
        transport,
        ridePath(`/requests/${encodeURIComponent(requestId)}/cancel`),
        { method: "POST" },
      ),
  };
}
