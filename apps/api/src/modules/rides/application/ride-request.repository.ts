import type {
  PublicRideRequest,
  PublicRideRequestList,
  RideContext,
  RideMineListQuery,
  RideRequestCreateInput,
  RideRequestForOwner,
  RideRequestForOwnerList,
  RideRequestStatus,
  RideRequestUpdateInput,
} from "@hooma/contracts/rides";

export interface RideRequestListInput {
  readonly limit: number;
  readonly cursor?: string;
  readonly context?: RideContext;
  readonly eventId?: string;
  readonly destinationPlaceId?: string;
  readonly from?: Date;
}

export interface RideRequestRepository {
  listPublic(input: RideRequestListInput): Promise<PublicRideRequestList>;
  listForRequester(
    requesterUserId: string,
    input: RideMineListQuery,
  ): Promise<RideRequestForOwnerList>;
  getPublic(rideRequestId: string): Promise<PublicRideRequest | null>;
  getForRequester(
    rideRequestId: string,
    requesterUserId: string,
  ): Promise<RideRequestForOwner | null>;
  create(requesterUserId: string, input: RideRequestCreateInput): Promise<RideRequestForOwner>;
  update(
    rideRequestId: string,
    requesterUserId: string,
    input: RideRequestUpdateInput,
  ): Promise<RideRequestForOwner | null>;
  updateStatus(
    rideRequestId: string,
    requesterUserId: string,
    status: RideRequestStatus,
  ): Promise<RideRequestForOwner | null>;
}
