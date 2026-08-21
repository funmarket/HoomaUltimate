export const EVENT_CHAT_OPEN_BEFORE_MS = 6 * 60 * 60 * 1000;
export const EVENT_CHAT_CLOSE_AFTER_MS = 6 * 60 * 60 * 1000;

export function eventChatWindow(startsAt: Date, endsAt: Date | null): { opensAt: Date; closesAt: Date } {
  return {
    opensAt: new Date(startsAt.getTime() - EVENT_CHAT_OPEN_BEFORE_MS),
    closesAt: new Date((endsAt ?? startsAt).getTime() + EVENT_CHAT_CLOSE_AFTER_MS)
  };
}

export function assertFreeEvent(entryFeeMinor: number | bigint): void {
  if (BigInt(entryFeeMinor) > 0n) {
    throw new Error("EVENT_PAYMENTS_NOT_ENABLED");
  }
}
