import type {
  ModerationNotificationType,
  UserNotificationContextType,
  UserNotificationRecord,
  UserNotificationRepository,
  WhistleNotificationType,
} from "./user-notification.repository.js";

export type WhistleNotificationInput = {
  recipientUserId: string;
  actorUserId: string;
  contextType: UserNotificationContextType;
  contextId: string;
  whistleId: string;
  createdAt: Date;
};

export type ModerationSanctionNotificationInput = {
  recipientUserId: string;
  actorUserId: string;
  sanctionId: string;
  actionType:
    | "YELLOW_CARD_WARNING"
    | "RED_CARD_BAN"
    | "TEMPORARY_BAN"
    | "READ_ONLY"
    | "ACCOUNT_DISABLED";
  strikeNumber: number | null;
  expiresAt: Date | null;
  createdAt: Date;
};

function whistleNotificationType(
  contextType: UserNotificationContextType,
): WhistleNotificationType {
  return contextType === "RIDE" ? "RIDE_WHISTLE" : "DIRECT_USER_WHISTLE";
}

function moderationNotificationType(
  actionType: ModerationSanctionNotificationInput["actionType"],
  strikeNumber: number | null,
): ModerationNotificationType {
  if (actionType === "YELLOW_CARD_WARNING") {
    return strikeNumber === 2 ? "MODERATION_SECOND_YELLOW_CARD" : "MODERATION_YELLOW_CARD";
  }
  if (actionType === "RED_CARD_BAN") return "MODERATION_RED_CARD_BAN";
  if (actionType === "TEMPORARY_BAN") return "MODERATION_TEMPORARY_BAN";
  if (actionType === "READ_ONLY") return "MODERATION_READ_ONLY";
  return "MODERATION_ACCOUNT_DISABLED";
}

function strikeNumber(type: UserNotificationRecord["type"]): number | null {
  if (type === "MODERATION_YELLOW_CARD") return 1;
  if (type === "MODERATION_SECOND_YELLOW_CARD") return 2;
  if (type === "MODERATION_RED_CARD_BAN") return 3;
  return null;
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
    sanctionId: record.sanctionId,
    strikeNumber: strikeNumber(record.type),
    expiresAt: record.expiresAt ? record.expiresAt.toISOString() : null,
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
      type: whistleNotificationType(input.contextType),
      contextType: input.contextType,
      contextId: input.contextId,
      whistleId: input.whistleId,
      createdAt: input.createdAt,
    });
  }

  async notifyModerationSanction(input: ModerationSanctionNotificationInput): Promise<void> {
    await this.repository.createModerationNotification({
      recipientUserId: input.recipientUserId,
      actorUserId: input.actorUserId,
      type: moderationNotificationType(input.actionType, input.strikeNumber),
      sanctionId: input.sanctionId,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
    });
  }

  async listForRecipient(recipientUserId: string) {
    const items = await this.repository.listForRecipient(recipientUserId, 50);
    return {
      unreadCount: items.filter((item) => item.readAt === null).length,
      items: items.map(serialize),
    };
  }

  async markRead(recipientUserId: string, notificationId: string) {
    await this.repository.markRead(recipientUserId, notificationId);
    return { ok: true as const };
  }
}
