export type UserNotificationErrorCode = "USER_NOTIFICATION_NOT_FOUND";

export class UserNotificationError extends Error {
  constructor(
    readonly code: UserNotificationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "UserNotificationError";
  }
}
