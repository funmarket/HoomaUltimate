import type { UserNotificationContextType } from "./user-notification.repository.js";

export interface WhistleNotificationNotifier {
  notifyWhistle(input: {
    readonly recipientUserId: string;
    readonly actorUserId: string;
    readonly contextType: UserNotificationContextType;
    readonly contextId: string;
    readonly whistleId: string;
    readonly createdAt: Date;
  }): Promise<void>;
}
