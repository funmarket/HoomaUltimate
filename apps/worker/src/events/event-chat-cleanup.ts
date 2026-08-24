import type { PrismaClient } from "@hooma/database";

export type EventChatCleanupDatabase = Pick<PrismaClient, "eventChatMessage" | "eventChatRoom">;

export interface EventChatCleanupResult {
  readonly deletedMessages: number;
  readonly deletedRooms: number;
}

export async function cleanupExpiredEventChat(
  database: EventChatCleanupDatabase,
  now: Date = new Date(),
): Promise<EventChatCleanupResult> {
  const messages = await database.eventChatMessage.deleteMany({
    where: { expiresAt: { lte: now } },
  });

  const rooms = await database.eventChatRoom.deleteMany({
    where: { closesAt: { lte: now } },
  });

  return {
    deletedMessages: messages.count,
    deletedRooms: rooms.count,
  };
}
