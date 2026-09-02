import type {
  UserNotificationContextType,
  UserNotificationRecord,
  UserNotificationRepository,
  UserNotificationType,
} from "./user-notification.repository.js";

export type WhistleNotificationInput = {
  recipientUserId: string;
  actorUserId: string;
  contextType: UserNotificationContextType;
  contextId: string;
  whistleId: string;
  createdAt: Date;
};

function notificationType(contextType: UserNotificationContextType): UserNotificationType {
  return contextType === "RIDE" ? "RIDE_WHISTLE" : "DIRECT_USER_WHISTLE";
}

function serialize(record: UserNotificationRecord) {
  return {
    id: record.id,
    recipientUserId: record.recipientUserId,
    actorUserId: record.actorUserId,
    type: record.type,
    contextType: record.contextType,
    contextId: record.contextId,
    whistleId: record.whistleId,
    createdAt: record.createdAt.toISOString(),
    readAt: record.readAt ? record.readAt.toISOString() : null,
  };
}

export class UserNotificationService {
  constructor(private readonly repository: UserNotificationRepository) {}

  async notifyWhistle(input: WhistleNotificationInput): Promise<void> {
    if (input.recipientUserId === input.actorUserId) return;
    await this.repository.createWhistleNotification({
      recipientUserId: input.recipientUserId,
      actorUserId: input.actorUserId,
      type: notificationType(input.contextType),
      contextType: input.contextType,
      contextId: input.contextId,
      whistleId: input.whistleId,
      createdAt: input.createdAt,
    });
  }

  async listForRecipient(recipientUserId: string) {
    const items = await this.repository.listForRecipient(recipientUserId, 50);
    return { items: items.map(serialize) };
  }
}
