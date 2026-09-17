export type RequestErrorCode =
  | "REQUEST_NOT_FOUND"
  | "REQUEST_COMMUNITY_PUBLISHER_FORBIDDEN"
  | "REQUEST_TEAM_PUBLISHER_FORBIDDEN"
  | "REQUEST_ATHLETES_PUBLISHER_FORBIDDEN"
  | "REQUEST_AUDIENCE_MEMBERSHIP_REQUIRED";

export class RequestError extends Error {
  override readonly name = "RequestError";

  constructor(
    readonly code: RequestErrorCode,
    message: string,
  ) {
    super(message);
  }
}
