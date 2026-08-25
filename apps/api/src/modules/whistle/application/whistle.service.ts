import { randomUUID } from "node:crypto";
import { AppError } from "../../../http/errors/app-error.js";
import type { CommunityService } from "../../communities/application/community.service.js";
import type {
  WhistleContextType,
  WhistleMetadataRecord,
  WhistleRepository,
} from "./whistle.repository.js";
import type { WhistleTransientStore } from "./whistle.store.js";

const DAILY_LIMIT = 11;

function graphemeCount(value: string): number {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(value)).length;
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function nextUtcMidnight(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

export type WhistleListItem = {
  id: string;
  authorUserId: string;
  body: string;
  createdAt: string;
  expiresAt: string;
  author: WhistleMetadataRecord["author"];
};

export class WhistleService {
  constructor(
    private readonly repository: WhistleRepository,
    private readonly transientStore: WhistleTransientStore,
    private readonly communities: CommunityService,
  ) {}

  private async authorizeContext(
    userId: string,
    contextType: WhistleContextType,
    contextId: string,
  ): Promise<void> {
    if (contextType === "COMMUNITY") {
      await this.communities.requireMember(contextId, userId);
      return;
    }
    throw new AppError(
      409,
      "WHISTLE_CONTEXT_NOT_ENABLED",
      `${contextType} Whistle context is not enabled yet`,
    );
  }

  async list(
    userId: string,
    contextType: WhistleContextType,
    contextId: string,
  ): Promise<{ items: WhistleListItem[]; remainingToday: number; resetsAt: string }> {
    await this.authorizeContext(userId, contextType, contextId);
    const now = new Date();
    const resetsAt = nextUtcMidnight(now);
    await this.repository.deleteExpired(now);
    const rows = await this.repository.listActive(contextType, contextId, now, 100);
    const [bodies, used] = await Promise.all([
      this.transientStore.getBodies(rows.map((row) => row.id)),
      this.repository.quotaUsed(userId, dayKey(now)),
    ]);

    return {
      items: rows.flatMap((row) => {
        const body = bodies.get(row.id);
        if (body === undefined) return [];
        return [
          {
            id: row.id,
            authorUserId: row.authorUserId,
            body,
            createdAt: row.createdAt.toISOString(),
            expiresAt: row.expiresAt.toISOString(),
            author: row.author,
          },
        ];
      }),
      remainingToday: Math.max(0, DAILY_LIMIT - used),
      resetsAt: resetsAt.toISOString(),
    };
  }

  async create(
    userId: string,
    contextType: WhistleContextType,
    contextId: string,
    rawBody: string,
  ) {
    await this.authorizeContext(userId, contextType, contextId);
    const body = rawBody.trim();
    const graphemes = graphemeCount(body);
    if (graphemes < 1) throw new AppError(400, "WHISTLE_EMPTY", "Whistle cannot be empty");
    if (graphemes > 33)
      throw new AppError(400, "WHISTLE_TOO_LONG", "Whistle is limited to 33 graphemes");

    const now = new Date();
    const expiresAt = nextUtcMidnight(now);
    const expiresInMilliseconds = expiresAt.getTime() - now.getTime();
    const id = randomUUID();

    await this.repository.deleteExpired(now);
    await this.transientStore.putBody(id, body, expiresInMilliseconds);
    try {
      const metadata = await this.repository.createWithDailyQuota({
        id,
        authorUserId: userId,
        contextType,
        contextId,
        createdAt: now,
        expiresAt,
        dayKey: dayKey(now),
        dailyLimit: DAILY_LIMIT,
      });
      if (!metadata) {
        await this.transientStore.deleteBody(id);
        throw new AppError(429, "WHISTLE_DAILY_LIMIT", "Daily Whistle limit reached");
      }
      const used = await this.repository.quotaUsed(userId, dayKey(now));
      return {
        whistle: {
          id: metadata.id,
          authorUserId: metadata.authorUserId,
          body,
          createdAt: metadata.createdAt.toISOString(),
          expiresAt: metadata.expiresAt.toISOString(),
          author: metadata.author,
        },
        remainingToday: Math.max(0, DAILY_LIMIT - used),
        resetsAt: expiresAt.toISOString(),
      };
    } catch (error) {
      await this.transientStore.deleteBody(id).catch(() => undefined);
      throw error;
    }
  }
}

export const WHISTLE_DAILY_LIMIT = DAILY_LIMIT;
