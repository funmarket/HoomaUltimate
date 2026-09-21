import { Prisma, type PrismaClient } from "@hooma/database";
import type {
  PasswordRecoveryChallengeCreateResult,
  PasswordRecoveryChallengeRecord,
  PasswordRecoveryRepository,
  TelegramPasswordRecoveryTarget,
} from "../application/password-recovery.repository.js";

export class PrismaPasswordRecoveryRepository implements PasswordRecoveryRepository {
  constructor(private readonly db: PrismaClient) {}

  async findTelegramTarget(loginUsername: string): Promise<TelegramPasswordRecoveryTarget | null> {
    const credential = await this.db.webCredential.findUnique({
      where: { loginUsername },
      select: {
        userId: true,
        loginUsername: true,
        user: {
          select: {
            telegramIdentity: { select: { telegramUserId: true } },
          },
        },
      },
    });
    const telegram = credential?.user.telegramIdentity;
    if (!credential || !telegram) return null;
    return {
      userId: credential.userId,
      loginUsername: credential.loginUsername,
      telegramUserId: telegram.telegramUserId,
    };
  }

  async createChallenge(input: {
    readonly userId: string;
    readonly codeHash: string;
    readonly expiresAt: Date;
    readonly now: Date;
    readonly notBefore: Date;
  }): Promise<PasswordRecoveryChallengeCreateResult> {
    return this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
        SELECT "userId"
        FROM "WebCredential"
        WHERE "userId" = ${input.userId}
        FOR UPDATE
      `);
      if (locked.length === 0) return { kind: "unavailable" as const };

      const recent = await tx.passwordRecoveryChallenge.findFirst({
        where: {
          userId: input.userId,
          createdAt: { gt: input.notBefore },
        },
        select: { id: true },
      });
      if (recent) return { kind: "cooldown" as const };

      await tx.passwordRecoveryChallenge.updateMany({
        where: { userId: input.userId, consumedAt: null },
        data: { consumedAt: input.now },
      });
      const challenge = await tx.passwordRecoveryChallenge.create({
        data: {
          userId: input.userId,
          codeHash: input.codeHash,
          expiresAt: input.expiresAt,
        },
        select: { id: true },
      });
      return { kind: "created" as const, id: challenge.id };
    });
  }

  findActiveChallenge(userId: string, now: Date): Promise<PasswordRecoveryChallengeRecord | null> {
    return this.db.passwordRecoveryChallenge.findFirst({
      where: {
        userId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        userId: true,
        codeHash: true,
        expiresAt: true,
        failedAttempts: true,
      },
    });
  }

  async recordFailedAttempt(challengeId: string, now: Date, consume: boolean): Promise<boolean> {
    const updated = await this.db.passwordRecoveryChallenge.updateMany({
      where: {
        id: challengeId,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        failedAttempts: { increment: 1 },
        ...(consume ? { consumedAt: now } : {}),
      },
    });
    return updated.count === 1;
  }

  async invalidateChallenge(challengeId: string, now: Date): Promise<void> {
    await this.db.passwordRecoveryChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { consumedAt: now },
    });
  }

  async completePasswordReset(input: {
    readonly challengeId: string;
    readonly userId: string;
    readonly passwordHash: string;
    readonly now: Date;
    readonly maxFailedAttempts: number;
  }): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ userId: string }>>(Prisma.sql`
        SELECT "userId"
        FROM "WebCredential"
        WHERE "userId" = ${input.userId}
        FOR UPDATE
      `);
      if (locked.length === 0) return false;

      const consumed = await tx.passwordRecoveryChallenge.updateMany({
        where: {
          id: input.challengeId,
          userId: input.userId,
          consumedAt: null,
          expiresAt: { gt: input.now },
          failedAttempts: { lt: input.maxFailedAttempts },
        },
        data: { consumedAt: input.now },
      });
      if (consumed.count !== 1) return false;

      await tx.webCredential.update({
        where: { userId: input.userId },
        data: {
          passwordHash: input.passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      });
      await tx.webSession.updateMany({
        where: { userId: input.userId, revokedAt: null },
        data: { revokedAt: input.now },
      });
      await tx.passwordRecoveryChallenge.updateMany({
        where: { userId: input.userId, consumedAt: null },
        data: { consumedAt: input.now },
      });
      return true;
    });
  }
}
