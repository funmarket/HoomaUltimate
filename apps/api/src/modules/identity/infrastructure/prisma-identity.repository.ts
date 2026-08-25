import type { TelegramIdentityInput } from "@hooma/auth";
import type { Prisma, PrismaClient } from "@hooma/database";
import type {
  IdentityRepository,
  LoginMethodsRecord,
  MeRecord,
  ProfileRecord,
  ProfileWriteInput,
  PublicProfileRecord,
  SessionRecord,
  TelegramLinkResult,
  WebCredentialRecord,
} from "../application/identity.repository.js";

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly db: PrismaClient) {}

  async createWebIdentity(input: {
    loginUsername: string;
    passwordHash: string;
    email: string | null;
    displayUsername: string;
    displayName: string;
  }): Promise<string> {
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: {} });
      await tx.userPresentation.create({
        data: {
          userId: user.id,
          username: input.displayUsername,
          displayName: input.displayName,
        },
      });
      await tx.webCredential.create({
        data: {
          userId: user.id,
          loginUsername: input.loginUsername,
          passwordHash: input.passwordHash,
          email: input.email,
        },
      });
      return user.id;
    });
  }

  async createWebCredentialForUser(input: {
    userId: string;
    loginUsername: string;
    passwordHash: string;
    email: string | null;
  }): Promise<void> {
    await this.db.webCredential.create({
      data: {
        userId: input.userId,
        loginUsername: input.loginUsername,
        passwordHash: input.passwordHash,
        email: input.email,
      },
    });
  }

  findWebCredential(loginUsername: string): Promise<WebCredentialRecord | null> {
    return this.db.webCredential.findUnique({
      where: { loginUsername },
      select: {
        userId: true,
        passwordHash: true,
        failedLoginCount: true,
        lockedUntil: true,
      },
    });
  }

  async recordLoginFailure(
    userId: string,
    failedLoginCount: number,
    lockedUntil: Date | null,
  ): Promise<void> {
    await this.db.webCredential.update({
      where: { userId },
      data: { failedLoginCount, lockedUntil },
    });
  }

  async recordLoginSuccess(userId: string): Promise<void> {
    await this.db.webCredential.update({
      where: { userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.webSession.create({ data: { userId, tokenHash, expiresAt } });
  }

  findActiveSession(tokenHash: string): Promise<SessionRecord | null> {
    return this.db.webSession.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { userId: true },
    });
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.db.webSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findTelegramUserId(telegramUserId: bigint): Promise<string | null> {
    const identity = await this.db.telegramIdentity.findUnique({
      where: { telegramUserId },
      select: { userId: true },
    });
    return identity?.userId ?? null;
  }

  async upsertTelegramIdentity(input: TelegramIdentityInput): Promise<string> {
    const existing = await this.db.telegramIdentity.findUnique({
      where: { telegramUserId: input.telegramUserId },
      select: { userId: true },
    });
    if (existing) {
      await this.refreshTelegramIdentity(existing.userId, input);
      return existing.userId;
    }

    try {
      return await this.db.$transaction(async (tx) => {
        const user = await tx.user.create({ data: {} });
        await tx.telegramIdentity.create({
          data: telegramIdentityData(user.id, input),
        });
        const username = await this.uniqueTelegramUsername(tx, input);
        await tx.userPresentation.create({
          data: {
            userId: user.id,
            username,
            displayName:
              [input.firstName, input.lastName].filter(Boolean).join(" ").trim() ||
              input.username ||
              "HOOMA member",
            photoUrl: input.photoUrl ?? null,
          },
        });
        return user.id;
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const concurrent = await this.db.telegramIdentity.findUnique({
        where: { telegramUserId: input.telegramUserId },
        select: { userId: true },
      });
      if (!concurrent) throw error;
      await this.refreshTelegramIdentity(concurrent.userId, input);
      return concurrent.userId;
    }
  }

  async findLoginMethods(userId: string): Promise<LoginMethodsRecord | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        webCredential: { select: { loginUsername: true, email: true } },
        telegramIdentity: { select: { telegramUsername: true } },
      },
    });
    if (!user) return null;
    return {
      web: user.webCredential,
      telegram: user.telegramIdentity,
    };
  }

  async attachTelegramIdentityToUser(
    userId: string,
    input: TelegramIdentityInput,
  ): Promise<TelegramLinkResult> {
    return this.db.$transaction(async (tx) => {
      const existingTelegram = await tx.telegramIdentity.findUnique({
        where: { telegramUserId: input.telegramUserId },
        select: { userId: true },
      });
      if (existingTelegram && existingTelegram.userId !== userId) {
        return { kind: "telegram_conflict" };
      }

      const targetTelegram = await tx.telegramIdentity.findUnique({
        where: { userId },
        select: { telegramUserId: true },
      });
      if (targetTelegram && targetTelegram.telegramUserId !== input.telegramUserId) {
        return { kind: "account_conflict" };
      }

      if (targetTelegram) {
        await tx.telegramIdentity.update({
          where: { userId },
          data: telegramIdentityRefreshData(input),
        });
      } else {
        await tx.telegramIdentity.create({
          data: telegramIdentityData(userId, input),
        });
      }
      return { kind: "linked", userId };
    });
  }

  async findPublicProfile(username: string): Promise<PublicProfileRecord | null> {
    const presentation = await this.db.userPresentation.findUnique({
      where: { username },
      select: {
        username: true,
        displayName: true,
        photoUrl: true,
        bio: true,
        user: {
          select: {
            identities: true,
            playerProfile: {
              select: { skillLevel: true, preferredPositions: true, overallRating: true },
            },
            teamPlayers: {
              where: { leftAt: null, active: true },
              orderBy: { joinedAt: "asc" },
              select: {
                team: {
                  select: { id: true, name: true, slug: true, badgeUrl: true },
                },
              },
            },
          },
        },
      },
    });
    if (!presentation) return null;
    const identities = presentation.user.identities;
    return {
      presentation: {
        username: presentation.username,
        displayName: presentation.displayName,
        photoUrl: presentation.photoUrl,
        bio: presentation.bio,
      },
      identities,
      player: identities.includes("PLAYER") ? presentation.user.playerProfile : null,
      teams: presentation.user.teamPlayers.map((row) => row.team),
    };
  }

  async findProfile(userId: string): Promise<ProfileRecord | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        identities: true,
        presentation: {
          select: { username: true, displayName: true, photoUrl: true, bio: true },
        },
        playerProfile: {
          select: { skillLevel: true, preferredPositions: true, overallRating: true },
        },
      },
    });
    if (!user?.presentation) return null;
    return {
      id: user.id,
      presentation: user.presentation,
      identities: user.identities,
      player: user.identities.includes("PLAYER") ? user.playerProfile : null,
    };
  }

  async updateProfile(userId: string, input: ProfileWriteInput): Promise<void> {
    await this.db.$transaction(async (tx) => {
      await tx.userPresentation.update({
        where: { userId },
        data: {
          username: input.username,
          displayName: input.displayName,
          photoUrl: input.photoUrl,
          bio: input.bio,
        },
      });
      await tx.user.update({
        where: { id: userId },
        data: { identities: input.identities },
      });
      if (input.identities.includes("PLAYER") && input.player) {
        await tx.playerProfile.upsert({
          where: { userId },
          create: {
            userId,
            skillLevel: input.player.skillLevel,
            preferredPositions: input.player.preferredPositions,
          },
          update: {
            skillLevel: input.player.skillLevel,
            preferredPositions: input.player.preferredPositions,
          },
        });
      }
    });
  }

  async updatePresentation(
    userId: string,
    input: {
      username: string;
      displayName: string;
      photoUrl: string | null;
      bio: string | null;
    },
  ): Promise<void> {
    await this.db.userPresentation.update({
      where: { userId },
      data: {
        username: input.username,
        displayName: input.displayName,
        photoUrl: input.photoUrl,
        bio: input.bio,
      },
    });
  }

  async findMe(userId: string): Promise<MeRecord | null> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        presentation: {
          select: { username: true, displayName: true, photoUrl: true, bio: true },
        },
        platformRoles: {
          where: { revokedAt: null, role: "PLATFORM_ADMIN" },
          select: { role: true },
        },
        communityMemberships: {
          where: { leftAt: null },
          select: {
            role: true,
            community: { select: { id: true, name: true, slug: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
        teamPlayers: {
          where: { leftAt: null },
          select: {
            team: { select: { id: true, name: true, slug: true, badgeUrl: true } },
          },
        },
        teamResponsibilities: {
          where: { revokedAt: null },
          select: {
            role: true,
            team: { select: { id: true, name: true, slug: true, badgeUrl: true } },
          },
        },
        teamCapabilityGrants: {
          where: { revokedAt: null },
          select: { teamId: true, capability: true },
        },
      },
    });
    if (!user?.presentation) return null;

    const teamMap = new Map<
      string,
      {
        id: string;
        name: string;
        slug: string;
        badgeUrl: string | null;
        isPlayer: boolean;
        responsibilities: ("COACH" | "ASSISTANT")[];
        capabilities: (
          | "EDIT_TEAM"
          | "MANAGE_ROSTER"
          | "MANAGE_LINEUP"
          | "CREATE_CHALLENGE"
          | "RESPOND_TO_CHALLENGE"
          | "MANAGE_TEAM_EVENTS"
        )[];
      }
    >();

    for (const row of user.teamPlayers) {
      teamMap.set(row.team.id, {
        ...row.team,
        isPlayer: true,
        responsibilities: [],
        capabilities: [],
      });
    }
    for (const row of user.teamResponsibilities) {
      const existingTeam = teamMap.get(row.team.id) ?? {
        ...row.team,
        isPlayer: false,
        responsibilities: [],
        capabilities: [],
      };
      if (!existingTeam.responsibilities.includes(row.role)) {
        existingTeam.responsibilities.push(row.role);
      }
      teamMap.set(row.team.id, existingTeam);
    }
    for (const grant of user.teamCapabilityGrants) {
      const existingTeam = teamMap.get(grant.teamId);
      if (existingTeam && !existingTeam.capabilities.includes(grant.capability)) {
        existingTeam.capabilities.push(grant.capability);
      }
    }

    return {
      id: user.id,
      presentation: user.presentation,
      platformRoles: user.platformRoles.map(() => "PLATFORM_ADMIN" as const),
      communities: user.communityMemberships.map((membership) => ({
        ...membership.community,
        role: membership.role,
      })),
      teams: [...teamMap.values()],
    };
  }

  private async refreshTelegramIdentity(
    userId: string,
    input: TelegramIdentityInput,
  ): Promise<void> {
    await this.db.telegramIdentity.update({
      where: { userId },
      data: telegramIdentityRefreshData(input),
    });
  }

  private async uniqueTelegramUsername(
    tx: Prisma.TransactionClient,
    input: TelegramIdentityInput,
  ): Promise<string> {
    const base = (input.username || `tg_${input.telegramUserId.toString()}`)
      .replace(/[^a-zA-Z0-9_.-]/g, "_")
      .slice(0, 48)
      .toLowerCase();
    let candidate = base;
    let suffix = 0;
    while (
      await tx.userPresentation.findUnique({
        where: { username: candidate },
        select: { userId: true },
      })
    ) {
      suffix += 1;
      candidate = `${base}_${suffix}`.slice(0, 64);
    }
    return candidate;
  }
}

function telegramIdentityData(userId: string, input: TelegramIdentityInput) {
  return {
    userId,
    telegramUserId: input.telegramUserId,
    telegramUsername: input.username ?? null,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    photoUrl: input.photoUrl ?? null,
    languageCode: input.languageCode ?? null,
    isPremium: input.isPremium ?? false,
  };
}

function telegramIdentityRefreshData(input: TelegramIdentityInput) {
  return {
    telegramUsername: input.username ?? null,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    photoUrl: input.photoUrl ?? null,
    languageCode: input.languageCode ?? null,
    isPremium: input.isPremium ?? false,
    lastAuthenticatedAt: new Date(),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
