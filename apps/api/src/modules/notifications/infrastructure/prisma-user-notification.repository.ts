import type { PrismaClient } from "@hooma/database";
import type {
  ModerationNotificationType,
  UserNotificationContextType,
  UserNotificationRecord,
  UserNotificationRepository,
  WhistleNotificationType,
} from "../application/user-notification.repository.js";

function parseNotificationContextType(value: string): UserNotificationContextType {
  if (value === "USER_DIRECT" || value === "RIDE") return value;
  throw new Error(`Unsupported notification context type: ${value}`);
}

function toRecord(row: {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  type: UserNotificationRecord["type"];
  contextType: UserNotificationContextType;
  contextId: string;
  whistleId: string | null;
  sanctionId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
  readAt: Date | null;
}): UserNotificationRecord {
  return row;
}

export class PrismaUserNotificationRepository implements UserNotificationRepository {
  constructor(private readonly db: PrismaClient) {}

  async createWhistleNotification(input: {
    recipientUserId: string;
    actorUserId: string;
    type: WhistleNotificationType;
    contextType: UserNotificationContextType;
    contextId: string;
    whistleId: string;
    createdAt: Date;
  }): Promise<UserNotificationRecord> {
    const notification = await this.db.userNotification.upsert({
      where: {
        recipientUserId_type_whistleId: {
          recipientUserId: input.recipientUserId,
          type: input.type,
          whistleId: input.whistleId,
        },
      },
      create: input,
      update: {},
    });
    return toRecord({
      ...notification,
      contextType: parseNotificationContextType(notification.contextType),
    });
  }

  async createModerationNotification(input: {
    recipientUserId: string;
    actorUserId: string;
    type: ModerationNotificationType;
    sanctionId: string;
    expiresAt: Date | null;
    createdAt: Date;
  }): Promise<UserNotificationRecord> {
    const notification = await this.db.userNotification.upsert({
      where: {
        recipientUserId_type_sanctionId: {
          recipientUserId: input.recipientUserId,
          type: input.type,
          sanctionId: input.sanctionId,
        },
      },
      create: {
        recipientUserId: input.recipientUserId,
        actorUserId: input.actorUserId,
        type: input.type,
        contextType: "USER_DIRECT",
        contextId: input.recipientUserId,
        sanctionId: input.sanctionId,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
      },
      update: {},
    });
    return toRecord({
      ...notification,
      contextType: parseNotificationContextType(notification.contextType),
    });
  }

  async listForRecipient(
    recipientUserId: string,
    limit: number,
  ): Promise<UserNotificationRecord[]> {
    const rows = await this.db.userNotification.findMany({
      where: {
        recipientUserId,
        contextType: { in: ["USER_DIRECT", "RIDE"] },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    });
    return rows.map((row) =>
      toRecord({
        ...row,
        contextType: parseNotificationContextType(row.contextType),
      }),
    );
  }

  async markRead(recipientUserId: string, notificationId: string): Promise<boolean> {
    const result = await this.db.userNotification.updateMany({
      where: { id: notificationId, recipientUserId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count > 0;
  }
}
