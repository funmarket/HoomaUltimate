import {
  formatPasswordRecoveryCode,
  hashPassword,
  hashPasswordRecoveryCode,
  isPasswordRecoveryCode,
  newPasswordRecoveryCode,
  normalizePasswordRecoveryCode,
  verifyPasswordRecoveryCode,
} from "@hooma/auth";
import type {
  PasswordRecoveryCodeResponse,
  PasswordRecoveryConfirmInput,
  PasswordRecoveryRequestInput,
} from "@hooma/contracts/auth-recovery";
import { PasswordRecoveryError } from "../domain/password-recovery-error.js";
import { normalizeUsername } from "../domain/normalization.js";
import type { PasswordRecoveryNotifier } from "./password-recovery-notifier.js";
import type { PasswordRecoveryRepository } from "./password-recovery.repository.js";

const RECOVERY_TTL_MS = 10 * 60_000;
const MAX_FAILED_ATTEMPTS = 5;

export class PasswordRecoveryService {
  constructor(
    private readonly repository: PasswordRecoveryRepository,
    private readonly notifier: PasswordRecoveryNotifier,
  ) {}

  async request(input: PasswordRecoveryRequestInput): Promise<{ ok: true }> {
    await hashPasswordRecoveryCode(newPasswordRecoveryCode());

    const target = await this.repository.findTelegramTarget(normalizeUsername(input.loginUsername));
    if (!target) return { ok: true };

    const now = new Date();
    await this.notifier.notify({
      userId: target.userId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + RECOVERY_TTL_MS),
    });
    return { ok: true };
  }

  async issueCodeFromNotification(
    userId: string,
    notificationId: string,
  ): Promise<PasswordRecoveryCodeResponse> {
    const target = await this.repository.findTelegramTargetByUserId(userId);
    if (!target) throw invalidRecoveryCode();

    const now = new Date();
    await this.notifier.requireActive({ userId, notificationId, now });

    const code = newPasswordRecoveryCode();
    const codeHash = await hashPasswordRecoveryCode(code);
    const expiresAt = new Date(now.getTime() + RECOVERY_TTL_MS);
    const created = await this.repository.createChallenge({
      userId,
      codeHash,
      expiresAt,
      now,
      notBefore: now,
    });
    if (created.kind !== "created") throw invalidRecoveryCode();

    await this.notifier.markRead(userId, notificationId);
    return {
      loginUsername: target.loginUsername,
      code: formatPasswordRecoveryCode(code),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async confirm(input: PasswordRecoveryConfirmInput): Promise<{ ok: true }> {
    const target = await this.repository.findTelegramTarget(normalizeUsername(input.loginUsername));
    const code = normalizePasswordRecoveryCode(input.code);
    if (!target || !isPasswordRecoveryCode(code)) throw invalidRecoveryCode();

    const now = new Date();
    const challenge = await this.repository.findActiveChallenge(target.userId, now);
    if (!challenge || challenge.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      throw invalidRecoveryCode();
    }

    if (!(await verifyPasswordRecoveryCode(challenge.codeHash, code))) {
      const consume = challenge.failedAttempts + 1 >= MAX_FAILED_ATTEMPTS;
      await this.repository.recordFailedAttempt(challenge.id, now, consume);
      throw invalidRecoveryCode();
    }

    const passwordHash = await hashPassword(input.newPassword);
    const completed = await this.repository.completePasswordReset({
      challengeId: challenge.id,
      userId: target.userId,
      passwordHash,
      now,
      maxFailedAttempts: MAX_FAILED_ATTEMPTS,
    });
    if (!completed) throw invalidRecoveryCode();
    return { ok: true };
  }
}

function invalidRecoveryCode(): PasswordRecoveryError {
  return new PasswordRecoveryError(
    "PASSWORD_RECOVERY_INVALID",
    "Recovery code is invalid or expired",
  );
}
