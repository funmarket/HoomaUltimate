import type { PrismaClient } from "@hooma/database";
import type { UserLastSeenReader } from "../application/user-last-seen.reader.js";

export class PrismaUserLastSeenReader implements UserLastSeenReader {
  constructor(private readonly db: PrismaClient) {}

  async findLastSeenByUserIds(userIds: readonly string[]): Promise<Map<string, Date | null>> {
    const uniqueUserIds = [...new Set(userIds)];
    const result = new Map<string, Date | null>(uniqueUserIds.map((userId) => [userId, null]));
    if (!uniqueUserIds.length) return result;

    const rows = await this.db.webSession.findMany({
      where: {
        userId: { in: uniqueUserIds },
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { userId: true, lastSeenAt: true },
      orderBy: [{ lastSeenAt: "desc" }, { id: "desc" }],
    });

    for (const row of rows) {
      if (result.get(row.userId) === null) result.set(row.userId, row.lastSeenAt);
    }
    return result;
  }
}
