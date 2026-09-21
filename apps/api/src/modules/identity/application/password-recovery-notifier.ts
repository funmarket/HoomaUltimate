export interface PasswordRecoveryNotifier {
  notify(input: {
    readonly userId: string;
    readonly createdAt: Date;
    readonly expiresAt: Date;
  }): Promise<void>;
  requireActive(input: {
    readonly userId: string;
    readonly notificationId: string;
    readonly now: Date;
  }): Promise<void>;
  markRead(userId: string, notificationId: string): Promise<void>;
}
