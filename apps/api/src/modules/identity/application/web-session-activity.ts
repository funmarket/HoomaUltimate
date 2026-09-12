export interface WebSessionActivity {
  resolveActiveSession(tokenHash: string, now: Date, touchBefore: Date): Promise<string | null>;
}
