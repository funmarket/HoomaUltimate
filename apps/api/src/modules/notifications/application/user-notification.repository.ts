export type WhistleNotificationType = "DIRECT_USER_WHISTLE" | "RIDE_WHISTLE";

export type ModerationNotificationType =
  | "MODERATION_YELLOW_CARD"
  | "MODERATION_SECOND_YELLOW_CARD"
  | "MODERATION_RED_CARD_BAN"
  | "MODERATION_TEMPORARY_BAN"
  | "MODERATION_READ_ONLY"
  | "MODERATION_ACCOUNT_DISABLED"
  | "MODERATION_SANCTION_CLEARED";

export type UserNotificationType =
  | WhistleNotificationType
  | ModerationNotificationType
  | "PASSWORD_RECOVERY";
export type UserNotificationContextType = "USER_DIRECT" | "RIDE";
export type UserNotificationReadOutcome = "marked_read" | "already_read" | "not_found";

export type UserNotificationRecord = {
  id: string;
  recipientUserId: string;
  actorUserId: string | null;
  type: UserNotificationType;
  contextType: UserNotificationContextType;
  contextId: string;
  whistleId: string | null;
  sanctionId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  readAt: Date | null;
};

export interface UserNotificationRepository {
  createWhistleNotification(input: {
    recipientUserId: string;
    actorUserId: string;
    type: WhistleNotificationType;
    contextType: UserNotificationContextType;
    contextId: string;
    whistleId: string;
    createdAt: Date;
  }): Promise<UserNotificationRecord>;
  createModerationNotification(input: {
    recipientUserId: string;
    actorUserId: string;
    type: ModerationNotificationType;
    sanctionId: string;
    expiresAt: Date | null;
    createdAt: Date;
  }): Promise<UserNotificationRecord>;
  createPasswordRecoveryNotification(input: {
    recipientUserId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<UserNotificationRecord>;
  findActivePasswordRecoveryNotification(
    recipientUserId: string,
    notificationId: string,
    now: Date,
  ): Promise<UserNotificationRecord | null>;
  listForRecipient(recipientUserId: string, limit: number): Promise<UserNotificationRecord[]>;
  countUnreadForRecipient(recipientUserId: string): Promise<number>;
  markRead(recipientUserId: string, notificationId: string): Promise<UserNotificationReadOutcome>;
}
