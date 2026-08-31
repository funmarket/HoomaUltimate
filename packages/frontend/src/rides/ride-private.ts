import { HoomaApiError } from "../http";

export function isExpectedPrivateMiss(reason: unknown): boolean {
  return (
    reason instanceof HoomaApiError &&
    [
      "AUTH_REQUIRED",
      "RIDE_OFFER_MANAGE_FORBIDDEN",
      "RIDE_REQUEST_MANAGE_FORBIDDEN",
      "RIDE_PARTICIPATION_NOT_FOUND",
      "RIDE_MEETING_POINT_FORBIDDEN",
    ].includes(reason.code ?? "")
  );
}
