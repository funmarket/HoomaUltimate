export type WhistleNotificationType = "DIRECT_USER_WHISTLE" | "RIDE_WHISTLE";

export type ModerationNotificationType =
  | "MODERATION_YELLOW_CARD"
  | "MODERATION_SECOND_YELLOW_CARD"
  | "MODERATION_RED_CARD_BAN"
  | "MODERATION_TEMPORARY_BAN"
  | "MODERATION_READ_ONLY"
  | "MODERATION_ACCOUNT_DISABLED"
  | "MODERATION_SANCTION_CLEARED";

export type UserNotificationType = WhistleNotificationType | ModerationNotificationType;
export type UserNotificationContextType = "USER_DIRECT" | "RIDE";

/**
 * "not_found" means the recipient has no such notification, so the caller must not
 * report success. "already_read" is an idempotent repeat of a successful read.
 */
export type UserNotificationReadOutcome = "marked_read" | "already_read" | "not_found";

export type UserNotificationRecord = {
  id: string;
  recipientUserId: string;
  actorUserId: string;
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
  listForRecipient(recipientUserId: string, limit: number): Promise<UserNotificationRecord[]>;
  /**
   * The recipient's unread total across every applicable notification row, not just the unread
   * entries inside a bounded page. Recipient-scoped exactly like `listForRecipient`.
   */
  countUnreadForRecipient(recipientUserId: string): Promise<number>;
  markRead(recipientUserId: string, notificationId: string): Promise<UserNotificationReadOutcome>;
}
