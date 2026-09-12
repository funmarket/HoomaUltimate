export const ATHLETES_CALENDAR_TIMEZONE = "Africa/Tunis";

export type CalendarDay = {
  readonly key: string;
  readonly day: number;
  readonly inMonth: boolean;
};

function partsForInstant(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: pick("year"),
    month: pick("month"),
    day: pick("day"),
    hour: pick("hour"),
    minute: pick("minute"),
    second: pick("second"),
  };
}

function keyFromParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function dateKeyForInstant(value: string | Date, timeZone: string): string {
  const parts = partsForInstant(typeof value === "string" ? new Date(value) : value, timeZone);
  return keyFromParts(parts.year, parts.month, parts.day);
}

export function timeForInstant(value: string | Date, timeZone: string): string {
  const parts = partsForInstant(typeof value === "string" ? new Date(value) : value, timeZone);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

export function todayKey(timeZone = ATHLETES_CALENDAR_TIMEZONE): string {
  return dateKeyForInstant(new Date(), timeZone);
}

export function firstOfMonth(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

function utcDateForKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
}

export function shiftMonth(key: string, amount: number): string {
  const date = utcDateForKey(firstOfMonth(key));
  date.setUTCMonth(date.getUTCMonth() + amount);
  return keyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
}

export function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(utcDateForKey(firstOfMonth(key)));
}

export function dayHeading(key: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(utcDateForKey(key));
}

export function buildMonthDays(monthKey: string): CalendarDay[] {
  const first = utcDateForKey(firstOfMonth(monthKey));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(start.getUTCDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const key = keyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    return { key, day: date.getUTCDate(), inMonth: date.getUTCMonth() === first.getUTCMonth() };
  });
}

function offsetMilliseconds(instant: Date, timeZone: string): number {
  const parts = partsForInstant(instant, timeZone);
  const renderedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return renderedAsUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

export function localDateTimeToIso(
  dateKey: string,
  time: string,
  timeZone = ATHLETES_CALENDAR_TIMEZONE,
): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const wallClock = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0);
  const guess = new Date(wallClock);
  const firstOffset = offsetMilliseconds(guess, timeZone);
  const firstInstant = new Date(wallClock - firstOffset);
  const resolvedOffset = offsetMilliseconds(firstInstant, timeZone);
  return new Date(wallClock - resolvedOffset).toISOString();
}

export function monthQueryRange(
  monthKey: string,
  timeZone = ATHLETES_CALENDAR_TIMEZONE,
): { from: string; to: string } {
  const days = buildMonthDays(monthKey);
  const fromKey = days[0]?.key ?? firstOfMonth(monthKey);
  const last = utcDateForKey(days.at(-1)?.key ?? firstOfMonth(monthKey));
  last.setUTCDate(last.getUTCDate() + 1);
  const toKey = keyFromParts(last.getUTCFullYear(), last.getUTCMonth() + 1, last.getUTCDate());
  return {
    from: localDateTimeToIso(fromKey, "00:00", timeZone),
    to: localDateTimeToIso(toKey, "00:00", timeZone),
  };
}
