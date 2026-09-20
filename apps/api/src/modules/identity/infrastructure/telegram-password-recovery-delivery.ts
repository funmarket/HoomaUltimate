import { sendTelegramMessage } from "../../../infrastructure/telegram/bot-api.js";
import type { PasswordRecoveryDelivery } from "../application/password-recovery-delivery.js";

export class TelegramPasswordRecoveryDelivery implements PasswordRecoveryDelivery {
  constructor(private readonly botToken: string) {}

  async sendTelegramRecoveryCode(input: {
    readonly telegramUserId: bigint;
    readonly loginUsername: string;
    readonly code: string;
    readonly expiresAt: Date;
  }): Promise<void> {
    const expiresAt = input.expiresAt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "UTC",
      timeZoneName: "short",
    });
    await sendTelegramMessage(
      this.botToken,
      input.telegramUserId.toString(),
      [
        "HOOMA password recovery",
        "",
        `A Web password reset was requested for login: ${input.loginUsername}`,
        "",
        `Recovery code: ${input.code}`,
        `Expires: ${expiresAt}`,
        "",
        "If you did not request this, ignore this message. Never share this code.",
      ].join("\n"),
    );
  }
}
