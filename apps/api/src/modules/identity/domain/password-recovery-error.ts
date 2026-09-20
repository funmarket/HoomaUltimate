export type PasswordRecoveryErrorCode = "PASSWORD_RECOVERY_INVALID";

export class PasswordRecoveryError extends Error {
  constructor(
    readonly code: PasswordRecoveryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PasswordRecoveryError";
  }
}
