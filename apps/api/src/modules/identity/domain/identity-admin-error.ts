export type IdentityAdminErrorCode =
  | "USER_SEARCH_QUERY_REQUIRED"
  | "USER_NOT_FOUND"
  | "USER_SESSION_REVOCATION_REASON_REQUIRED"
  | "USER_SESSION_REVOCATION_TARGET_FORBIDDEN";

export class IdentityAdminError extends Error {
  constructor(
    readonly code: IdentityAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IdentityAdminError";
  }
}
