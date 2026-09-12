import type { PrismaClient } from "@hooma/database";
import type { WebSessionActivity } from "../application/web-session-activity.js";

export class PrismaWebSessionActivity implements WebSessionActivity {
  constructor(private readonly db: PrismaClient) {}

  async resolveActiveSession(tokenHash: string, now: Date, touchBefore: Date): Promise<string | null> {
    const session = await this.db.webSession.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: now } },
      select: { id: true, userId: true, lastSeenAt: true },
    });
    if (!session) return null;

    if (session.lastSeenAt <= touchBefore) {
      await this.db.webSession.updateMany({
        where: {
          id: session.id,
          revokedAt: null,
          expiresAt: { gt: now },
          lastSeenAt: { lte: touchBefore },
        },
        data: { lastSeenAt: now },
      });
    }
    return session.userId;
  }
}
