import {
  hashPassword,
  hashSessionToken,
  newSessionToken,
  validateTelegramInitData,
  verifyPassword,
  type AuthTransport,
  type TelegramIdentityInput,
} from "@hooma/auth";
import type { ApiConfig } from "@hooma/config";
import type {
  LoginInput,
  MeResponse,
  ProfilePresentationUpdateInput,
  RegisterInput,
} from "@hooma/contracts";
import type { ProfileResponse, ProfileUpdateInput } from "@hooma/contracts/profile";
import { AppError } from "../../../http/errors/app-error.js";
import type { IdentityRepository } from "./identity.repository.js";
import { defaultDisplayName, normalizeEmail, normalizeUsername } from "../domain/normalization.js";

export type TelegramResolution =
  | { kind: "absent" }
  | { kind: "invalid" }
  | { kind: "unregistered" }
  | { kind: "valid"; userId: string };

export class IdentityService {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly config: ApiConfig,
  ) {}

  async register(input: RegisterInput): Promise<{ sessionToken: string }> {
    const loginUsername = normalizeUsername(input.loginUsername);
    const displayUsername = normalizeUsername(input.displayUsername);
    const passwordHash = await hashPassword(input.password);
    try {
      const userId = await this.repository.createWebIdentity({
        loginUsername,
        passwordHash,
        email: normalizeEmail(input.email),
        displayUsername,
        displayName: defaultDisplayName(input.displayName, input.displayUsername),
      });
      return this.issueSession(userId);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(
          409,
          "IDENTITY_CONFLICT",
          "Login username, display username, or email already exists",
        );
      }
      throw error;
    }
  }

  async login(input: LoginInput): Promise<{ sessionToken: string }> {
    const credential = await this.repository.findWebCredential(
      normalizeUsername(input.loginUsername),
    );
    if (!credential) throw new AppError(401, "LOGIN_INVALID", "Invalid username or password");
    if (credential.lockedUntil && credential.lockedUntil > new Date()) {
      throw new AppError(429, "LOGIN_LOCKED", "Too many failed login attempts. Try again later.");
    }
    if (!(await verifyPassword(credential.passwordHash, input.password))) {
      const nextCount = credential.failedLoginCount + 1;
      await this.repository.recordLoginFailure(
        credential.userId,
        nextCount,
        nextCount >= 5 ? new Date(Date.now() + 15 * 60_000) : null,
      );
      throw new AppError(401, "LOGIN_INVALID", "Invalid username or password");
    }
    await this.repository.recordLoginSuccess(credential.userId);
    return this.issueSession(credential.userId);
  }

  async resolveWebSession(rawToken: string | undefined): Promise<string | null> {
    if (!rawToken) return null;
    return (await this.repository.findActiveSession(hashSessionToken(rawToken)))?.userId ?? null;
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await this.repository.revokeSession(hashSessionToken(rawToken));
  }

  async resolveTelegram(rawInitData: string | undefined): Promise<TelegramResolution> {
    if (!rawInitData) return { kind: "absent" };
    if (!this.config.TELEGRAM_BOT_TOKEN) return { kind: "invalid" };
    let identity: TelegramIdentityInput;
    try {
      identity = validateTelegramInitData(
        rawInitData,
        this.config.TELEGRAM_BOT_TOKEN,
        this.config.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
      );
    } catch {
      return { kind: "invalid" };
    }
    const userId = await this.repository.findTelegramUserId(identity.telegramUserId);
    return userId ? { kind: "valid", userId } : { kind: "unregistered" };
  }

  async provisionTelegramAccount(
    rawInitData: string | undefined,
    webUserId: string | null = null,
  ): Promise<{ userId: string }> {
    if (!rawInitData || !this.config.TELEGRAM_BOT_TOKEN) {
      throw new AppError(
        401,
        "TELEGRAM_AUTH_REQUIRED",
        "Valid Telegram authentication is required to create a HOOMA account",
      );
    }
    let identity: TelegramIdentityInput;
    try {
      identity = validateTelegramInitData(
        rawInitData,
        this.config.TELEGRAM_BOT_TOKEN,
        this.config.TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
      );
    } catch {
      throw new AppError(
        401,
        "TELEGRAM_AUTH_INVALID",
        "Invalid or expired Telegram authentication",
      );
    }
    const existingTelegramUserId = await this.repository.findTelegramUserId(
      identity.telegramUserId,
    );
    if (webUserId && !existingTelegramUserId) {
      throw new AppError(
        409,
        "ACCOUNT_LINK_REQUIRED",
        "This Telegram identity is not linked to the signed-in HOOMA account",
      );
    }
    if (webUserId && existingTelegramUserId && webUserId !== existingTelegramUserId) {
      throw new AppError(
        401,
        "AUTH_CONFLICT",
        "Telegram and Web credentials resolve to different users",
      );
    }
    return { userId: await this.repository.upsertTelegramIdentity(identity) };
  }

  async publicProfile(username: string) {
    const profile = await this.repository.findPublicProfile(normalizeUsername(username));
    if (!profile) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    return profile;
  }

  async profile(userId: string): Promise<ProfileResponse> {
    const profile = await this.repository.findProfile(userId);
    if (!profile) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    return {
      id: profile.id,
      presentation: profile.presentation,
      identities: [...profile.identities],
      player: profile.player
        ? {
            skillLevel: profile.player.skillLevel,
            preferredPositions: [...profile.player.preferredPositions] as ProfileResponse["player"] extends infer Player
              ? Player extends { preferredPositions: infer Positions }
                ? Positions
                : never
              : never,
            overallRating: profile.player.overallRating,
          }
        : null,
    };
  }

  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<ProfileResponse> {
    try {
      await this.repository.updateProfile(userId, {
        username: normalizeUsername(input.username),
        displayName: input.displayName.trim(),
        photoUrl: input.photoUrl?.trim() || null,
        bio: input.bio?.trim() || null,
        identities: [...input.identities],
        player: input.player
          ? {
              skillLevel: input.player.skillLevel,
              preferredPositions: [...input.player.preferredPositions],
            }
          : null,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(
          409,
          "PRESENTATION_USERNAME_CONFLICT",
          "That HOOMA username is already in use",
        );
      }
      throw error;
    }
    return this.profile(userId);
  }

  async me(userId: string, transports: readonly AuthTransport[]): Promise<MeResponse> {
    const user = await this.repository.findMe(userId);
    if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
    return {
      id: user.id,
      presentation: user.presentation,
      transports: [...transports],
      platformRoles: [...user.platformRoles],
      communities: [...user.communities],
      teams: user.teams.map((team) => ({
        ...team,
        responsibilities: [...team.responsibilities],
        capabilities: [...team.capabilities],
      })),
    };
  }

  async updatePresentation(
    userId: string,
    transports: readonly AuthTransport[],
    input: ProfilePresentationUpdateInput,
  ): Promise<MeResponse> {
    try {
      await this.repository.updatePresentation(userId, {
        username: normalizeUsername(input.username),
        displayName: input.displayName.trim(),
        photoUrl: input.photoUrl?.trim() || null,
        bio: input.bio?.trim() || null,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new AppError(
          409,
          "PRESENTATION_USERNAME_CONFLICT",
          "That HOOMA username is already in use",
        );
      }
      throw error;
    }
    return this.me(userId, transports);
  }

  private async issueSession(userId: string): Promise<{ sessionToken: string }> {
    const sessionToken = newSessionToken();
    await this.repository.createSession(
      userId,
      hashSessionToken(sessionToken),
      new Date(Date.now() + this.config.SESSION_TTL_HOURS * 60 * 60 * 1000),
    );
    return { sessionToken };
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}
