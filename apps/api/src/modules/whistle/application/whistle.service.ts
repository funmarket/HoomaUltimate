import { randomUUID } from "node:crypto";
import { AppError } from "../../../http/errors/app-error.js";
import type { AthletesService } from "../../athletes/application/athletes.service.js";
import type { CommunityService } from "../../communities/application/community.service.js";
import type { EventService } from "../../events/application/event.service.js";
import type { GamerService } from "../../gamers/application/gamer.service.js";
import type { CanonicalUserReader } from "../../identity/application/canonical-user.reader.js";
import type { RideService } from "../../rides/application/ride.service.js";
import type { UserNotificationService } from "../../notifications/application/user-notification.service.js";
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

type ContextAuthorization = { readonly notificationRecipientUserId?: string };

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
    private readonly events: EventService,
    private readonly gamers: GamerService,
    private readonly users: CanonicalUserReader,
    private readonly athletes: AthletesService,
    private readonly rides?: RideService,
    private readonly notifications?: UserNotificationService,
  ) {}

  private async authorizeContext(
    userId: string,
    contextType: WhistleContextType,
    contextId: string,
    action: "read" | "post",
  ): Promise<ContextAuthorization> {
    if (contextType === "COMMUNITY") {
      await this.communities.requireMember(contextId, userId);
      return {};
    }
    if (contextType === "EVENT") {
      await this.events.requireMemberContent(userId, contextId);
      return {};
    }
    if (contextType === "ATHLETES") {
      await this.athletes.requireMemberContent(userId, contextId);
      return {};
    }
    if (contextType === "RIDE") {
      if (!this.rides) {
        throw new AppError(
          409,
          "WHISTLE_CONTEXT_NOT_ENABLED",
          "RIDE Whistle context is not enabled yet",
        );
      }
      const authorization =
        action === "post"
          ? await this.rides.requireWhistlePost(userId, contextId)
          : await this.rides.requireWhistleRead(userId, contextId);
      return { notificationRecipientUserId: authorization.ownerUserId };
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
    await this.authorizeContext(userId, contextType, contextId, "read");
    return this.listAuthorized(userId, contextType, contextId);
  }

  async create(
    userId: string,
    contextType: WhistleContextType,
    contextId: string,
    rawBody: string,
  ) {
    const authorization = await this.authorizeContext(userId, contextType, contextId, "post");
    return this.createAuthorized(
      userId,
      contextType,
      contextId,
      rawBody,
      authorization.notificationRecipientUserId
        ? { recipientUserId: authorization.notificationRecipientUserId }
        : {},
    );
  }

  async listDirectGamer(userId: string, otherProfileId: string) {
    const contextId = await this.gamers.resolveDirectWhistleContext(userId, otherProfileId);
    return this.listAuthorized(userId, "GAMER_DIRECT", contextId);
  }

  async createDirectGamer(userId: string, otherProfileId: string, rawBody: string) {
    const contextId = await this.gamers.resolveDirectWhistleContext(userId, otherProfileId);
    return this.createAuthorized(userId, "GAMER_DIRECT", contextId, rawBody);
  }

  async listDirectUser(userId: string, targetUsername: string) {
    const directContext = await this.resolveDirectUserContext(userId, targetUsername);
    return this.listAuthorized(userId, "USER_DIRECT", directContext.contextId);
  }

  async createDirectUser(userId: string, targetUsername: string, rawBody: string) {
    const directContext = await this.resolveDirectUserContext(userId, targetUsername);
    return this.createAuthorized(userId, "USER_DIRECT", directContext.contextId, rawBody, {
      recipientUserId: directContext.targetUserId,
    });
  }

  private async resolveDirectUserContext(
    userId: string,
    targetUsername: string,
  ): Promise<{ contextId: string; targetUserId: string }> {
    const targetUserId = await this.users.findUserIdByUsername(targetUsername);
    if (!targetUserId) {
      throw new AppError(404, "USER_NOT_FOUND", "User not found");
    }
    if (targetUserId === userId) {
      throw new AppError(400, "USER_WHISTLE_SELF_FORBIDDEN", "You cannot Whistle yourself");
    }
    return { contextId: [userId, targetUserId].sort().join(":"), targetUserId };
  }

  private async listAuthorized(
    userId: string,
    contextType: WhistleContextType,
    contextId: string,
  ): Promise<{ items: WhistleListItem[]; remainingToday: number; resetsAt: string }> {
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

  private async createAuthorized(
    userId: string,
    contextType: WhistleContextType,
    contextId: string,
    rawBody: string,
    notification: { readonly recipientUserId?: string } = {},
  ) {
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
      const result = {
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
      if (
        notification.recipientUserId &&
        this.notifications &&
        (contextType === "RIDE" || contextType === "USER_DIRECT")
      ) {
        await this.notifications.notifyWhistle({
          recipientUserId: notification.recipientUserId,
          actorUserId: userId,
          contextType,
          contextId,
          whistleId: metadata.id,
          createdAt: metadata.createdAt,
        });
      }
      return result;
    } catch (error) {
      await this.transientStore.deleteBody(id).catch(() => undefined);
      throw error;
    }
  }
}

export const WHISTLE_DAILY_LIMIT = DAILY_LIMIT;
