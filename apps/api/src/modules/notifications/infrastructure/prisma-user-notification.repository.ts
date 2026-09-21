import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  ModerationNotificationType,
  UserNotificationContextType,
  UserNotificationReadOutcome,
  UserNotificationRecord,
  UserNotificationRepository,
  WhistleNotificationType,
} from "../application/user-notification.repository.js";

function parseNotificationContextType(value: string): UserNotificationContextType {
  if (value === "USER_DIRECT" || value === "RIDE") return value;
  throw new Error(`Unsupported notification context type: ${value}`);
}

/**
 * The notification rows a recipient can actually receive. The bounded list page and the
 * recipient-wide unread total must agree on applicability, so both read this one predicate.
 */
function recipientNotificationWhere(recipientUserId: string): Prisma.UserNotificationWhereInput {
  return {
    recipientUserId,
    contextType: { in: ["USER_DIRECT", "RIDE"] },
    AND: [
      {
        OR: [{ type: { not: "PASSWORD_RECOVERY" } }, { expiresAt: { gt: new Date() } }],
      },
    ],
  };
}

function toRecord(row: {
  id: string;
  recipientUserId: string;
  actorUserId: string | null;
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

  async createPasswordRecoveryNotification(input: {
    recipientUserId: string;
    createdAt: Date;
    expiresAt: Date;
  }): Promise<UserNotificationRecord> {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "User"
        WHERE "id" = ${input.recipientUserId}
        FOR UPDATE
      `);

      const existing = await tx.userNotification.findFirst({
        where: {
          recipientUserId: input.recipientUserId,
          type: "PASSWORD_RECOVERY",
          readAt: null,
          expiresAt: { gt: input.createdAt },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      if (existing) {
        return toRecord({
          ...existing,
          contextType: parseNotificationContextType(existing.contextType),
        });
      }

      const notification = await tx.userNotification.create({
        data: {
          recipientUserId: input.recipientUserId,
          actorUserId: null,
          type: "PASSWORD_RECOVERY",
          contextType: "USER_DIRECT",
          contextId: input.recipientUserId,
          expiresAt: input.expiresAt,
          createdAt: input.createdAt,
        },
      });
      return toRecord({
        ...notification,
        contextType: parseNotificationContextType(notification.contextType),
      });
    });
  }

  async findActivePasswordRecoveryNotification(
    recipientUserId: string,
    notificationId: string,
    now: Date,
  ): Promise<UserNotificationRecord | null> {
    const notification = await this.db.userNotification.findFirst({
      where: {
        id: notificationId,
        recipientUserId,
        type: "PASSWORD_RECOVERY",
        expiresAt: { gt: now },
      },
    });
    if (!notification) return null;
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
      where: recipientNotificationWhere(recipientUserId),
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

  async countUnreadForRecipient(recipientUserId: string): Promise<number> {
    return this.db.userNotification.count({
      where: { ...recipientNotificationWhere(recipientUserId), readAt: null },
    });
  }

  async markRead(
    recipientUserId: string,
    notificationId: string,
  ): Promise<UserNotificationReadOutcome> {
    // Read first so a repeat call stays idempotent while an unknown or foreign id is
    // reported as "not_found" instead of a fake success.
    const existing = await this.db.userNotification.findFirst({
      where: { id: notificationId, recipientUserId },
      select: { readAt: true },
    });
    if (!existing) return "not_found";
    if (existing.readAt !== null) return "already_read";
    const updated = await this.db.userNotification.updateMany({
      where: { id: notificationId, recipientUserId, readAt: null },
      data: { readAt: new Date() },
    });
    return updated.count > 0 ? "marked_read" : "already_read";
  }
}
