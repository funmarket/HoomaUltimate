export interface PasswordRecoveryDelivery {
  sendTelegramRecoveryCode(input: {
    readonly telegramUserId: bigint;
    readonly loginUsername: string;
    readonly code: string;
    readonly expiresAt: Date;
  }): Promise<void>;
}
