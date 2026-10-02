export interface RideWhistleAuthorization {
  readonly ownerUserId: string;
}

export interface RideWhistleAccessAuthorizer {
  requireWhistleRead(
    viewerUserId: string,
    rideRequestId: string,
  ): Promise<RideWhistleAuthorization>;

  requireWhistlePost(actorUserId: string, rideRequestId: string): Promise<RideWhistleAuthorization>;
}
