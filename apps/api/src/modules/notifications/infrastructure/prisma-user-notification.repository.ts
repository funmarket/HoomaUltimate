import type { PrismaClient } from "@hooma/database";
import type {
  UserNotificationContextType,
  UserNotificationRecord,
  UserNotificationRepository,
} from "../application/user-notification.repository.js";

function parseNotificationContextType(value: string): UserNotificationContextType {
  if (value === "USER_DIRECT" || value === "RIDE") return value;
  throw new Error(`Unsupported Whistle notification context type: ${value}`);
}

function toRecord(row: {
  id: string;
  recipientUserId: string;
  actorUserId: string;
  type: UserNotificationRecord["type"];
  contextType: UserNotificationContextType;
  contextId: string;
  whistleId: string;
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
    type: UserNotificationRecord["type"];
    contextType: UserNotificationRecord["contextType"];
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
    return toRecord({ ...notification, contextType: input.contextType });
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
      toRecord({ ...row, contextType: parseNotificationContextType(row.contextType) }),
    );
  }
}
