export type IdentityAdminErrorCode =
  | "USER_SEARCH_QUERY_REQUIRED"
  | "USER_NOT_FOUND"
  | "USER_SESSION_REVOCATION_REASON_REQUIRED"
  | "USER_SESSION_REVOCATION_TARGET_FORBIDDEN"
  | "USER_SANCTION_REASON_REQUIRED"
  | "USER_SANCTION_TARGET_FORBIDDEN"
  | "USER_SANCTION_DURATION_REQUIRED"
  | "USER_SANCTION_NOT_FOUND";

export class IdentityAdminError extends Error {
  constructor(
    readonly code: IdentityAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "IdentityAdminError";
  }
}
