import type { RidePolicyErrorCode } from "./ride-policy.js";

export type RideErrorCode =
  | RidePolicyErrorCode
  | "RIDE_OFFER_NOT_FOUND"
  | "RIDE_OFFER_NOT_MUTABLE"
  | "RIDE_REQUEST_NOT_FOUND"
  | "RIDE_REQUEST_NOT_MUTABLE"
  | "RIDE_PARTICIPATION_NOT_AVAILABLE"
  | "RIDE_PARTICIPATION_CANCEL_FORBIDDEN"
  | "RIDE_MEETING_POINT_NOT_AVAILABLE"
  | "RIDE_MEETING_POINT_FORBIDDEN"
  | "RIDE_OFFER_STATUS_NOT_CHANGED"
  | "RIDE_REQUEST_STATUS_NOT_CHANGED"
  | "RIDE_PARTICIPATION_STATUS_NOT_CHANGED"
  | "RIDE_OFFER_MANAGE_FORBIDDEN"
  | "RIDE_REQUEST_MANAGE_FORBIDDEN"
  | "RIDE_DESTINATION_EVENT_NOT_FOUND"
  | "RIDE_DESTINATION_PLACE_NOT_FOUND";

export class RideError extends Error {
  constructor(
    public readonly code: RideErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "RideError";
  }
}
