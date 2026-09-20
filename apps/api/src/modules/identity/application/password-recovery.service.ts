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
  PasswordRecoveryConfirmInput,
  PasswordRecoveryRequestInput,
} from "@hooma/contracts";
import { AppError } from "../../../http/errors/app-error.js";
import { normalizeUsername } from "../domain/normalization.js";
import type { PasswordRecoveryDelivery } from "./password-recovery-delivery.js";
import type { PasswordRecoveryRepository } from "./password-recovery.repository.js";

const RECOVERY_TTL_MS = 10 * 60_000;
const RECOVERY_REQUEST_COOLDOWN_MS = 60_000;
const MAX_FAILED_ATTEMPTS = 5;

export class PasswordRecoveryService {
  constructor(
    private readonly repository: PasswordRecoveryRepository,
    private readonly delivery: PasswordRecoveryDelivery,
  ) {}

  async request(input: PasswordRecoveryRequestInput): Promise<{ ok: true }> {
    const target = await this.repository.findTelegramTarget(normalizeUsername(input.loginUsername));
    if (!target) return { ok: true };

    const now = new Date();
    const code = newPasswordRecoveryCode();
    const codeHash = await hashPasswordRecoveryCode(code);
    const expiresAt = new Date(now.getTime() + RECOVERY_TTL_MS);
    const created = await this.repository.createChallenge({
      userId: target.userId,
      codeHash,
      expiresAt,
      now,
      notBefore: new Date(now.getTime() - RECOVERY_REQUEST_COOLDOWN_MS),
    });
    if (created.kind !== "created") return { ok: true };

    try {
      await this.delivery.sendTelegramRecoveryCode({
        telegramUserId: target.telegramUserId,
        loginUsername: target.loginUsername,
        code: formatPasswordRecoveryCode(code),
        expiresAt,
      });
    } catch {
      await this.repository.invalidateChallenge(created.id, now);
    }
    return { ok: true };
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

function invalidRecoveryCode(): AppError {
  return new AppError(
    400,
    "PASSWORD_RECOVERY_INVALID",
    "Recovery code is invalid or expired",
  );
}
