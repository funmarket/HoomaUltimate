export type AthletesErrorCode =
  | "ATHLETES_NOT_FOUND"
  | "ATHLETES_JOIN_REQUEST_NOT_FOUND"
  | "ATHLETES_MEMBER_REQUIRED"
  | "ATHLETES_FOUNDER_REQUIRED"
  | "ATHLETES_MANAGER_REQUIRED"
  | "ATHLETES_USER_NOT_FOUND"
  | "ATHLETES_MEMBER_NOT_FOUND"
  | "ATHLETES_FOUNDER_REMOVE_FORBIDDEN"
  | "ATHLETES_MODERATOR_SCOPE"
  | "ATHLETES_FOUNDER_ROLE_FORBIDDEN"
  | "ATHLETES_CONFLICT";

export class AthletesError extends Error {
  constructor(
    readonly code: AthletesErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AthletesError";
  }
}
