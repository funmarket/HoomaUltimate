export type UserNotificationType = "DIRECT_USER_WHISTLE" | "RIDE_WHISTLE";

export type UserNotificationContextType = "USER_DIRECT" | "RIDE";

export type UserNotificationRecord = {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  type: UserNotificationType;
  contextType: UserNotificationContextType;
  contextId: string;
  whistleId: string;
  createdAt: Date;
  readAt: Date | null;
};

export interface UserNotificationRepository {
  createWhistleNotification(input: {
    recipientUserId: string;
    actorUserId: string;
    type: UserNotificationType;
    contextType: UserNotificationContextType;
    contextId: string;
    whistleId: string;
    createdAt: Date;
  }): Promise<UserNotificationRecord>;
  listForRecipient(recipientUserId: string, limit: number): Promise<UserNotificationRecord[]>;
}
