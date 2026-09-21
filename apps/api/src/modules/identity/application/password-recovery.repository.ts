export interface TelegramPasswordRecoveryTarget {
  readonly userId: string;
  readonly loginUsername: string;
}

export interface PasswordRecoveryChallengeRecord {
  readonly id: string;
  readonly userId: string;
  readonly codeHash: string;
  readonly expiresAt: Date;
  readonly failedAttempts: number;
}

export type PasswordRecoveryChallengeCreateResult =
  | { readonly kind: "created"; readonly id: string }
  | { readonly kind: "cooldown" }
  | { readonly kind: "unavailable" };

export interface PasswordRecoveryRepository {
  findTelegramTarget(loginUsername: string): Promise<TelegramPasswordRecoveryTarget | null>;
  findTelegramTargetByUserId(userId: string): Promise<TelegramPasswordRecoveryTarget | null>;
  createChallenge(input: {
    readonly userId: string;
    readonly codeHash: string;
    readonly expiresAt: Date;
    readonly now: Date;
    readonly notBefore: Date;
  }): Promise<PasswordRecoveryChallengeCreateResult>;
  findActiveChallenge(userId: string, now: Date): Promise<PasswordRecoveryChallengeRecord | null>;
  recordFailedAttempt(challengeId: string, now: Date, consume: boolean): Promise<boolean>;
  invalidateChallenge(challengeId: string, now: Date): Promise<void>;
  completePasswordReset(input: {
    readonly challengeId: string;
    readonly userId: string;
    readonly passwordHash: string;
    readonly now: Date;
    readonly maxFailedAttempts: number;
  }): Promise<boolean>;
}
