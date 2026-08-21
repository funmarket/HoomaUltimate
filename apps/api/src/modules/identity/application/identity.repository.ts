import type { TelegramIdentityInput } from "@hooma/auth";

export interface WebCredentialRecord {
  readonly userId: string;
  readonly passwordHash: string;
  readonly failedLoginCount: number;
  readonly lockedUntil: Date | null;
}

export interface SessionRecord {
  readonly userId: string;
}

export interface MeRecord {
  readonly id: string;
  readonly presentation: {
    readonly username: string;
    readonly displayName: string;
    readonly photoUrl: string | null;
    readonly bio: string | null;
  };
  readonly platformRoles: readonly "PLATFORM_ADMIN"[];
}

export interface IdentityRepository {
  createWebIdentity(input: {
    loginUsername: string;
    passwordHash: string;
    email: string | null;
    displayUsername: string;
    displayName: string;
  }): Promise<string>;
  findWebCredential(loginUsername: string): Promise<WebCredentialRecord | null>;
  recordLoginFailure(userId: string, failedLoginCount: number, lockedUntil: Date | null): Promise<void>;
  recordLoginSuccess(userId: string): Promise<void>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findActiveSession(tokenHash: string): Promise<SessionRecord | null>;
  revokeSession(tokenHash: string): Promise<void>;
  upsertTelegramIdentity(input: TelegramIdentityInput): Promise<string>;
  findMe(userId: string): Promise<MeRecord | null>;
}
