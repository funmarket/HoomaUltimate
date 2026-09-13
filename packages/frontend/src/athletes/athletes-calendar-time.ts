const dateKeyFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function deviceTimezone(): string {
  const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return resolved && isIanaTimezone(resolved) ? resolved : "UTC";
}

function dateKeyFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = dateKeyFormatterCache.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateKeyFormatterCache.set(timezone, formatter);
  }
  return formatter;
}

export function dateKeyForInstant(instant: string | Date, timezone: string): string {
  const parts = dateKeyFormatter(timezone).formatToParts(
    typeof instant === "string" ? new Date(instant) : instant,
  );
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("Unable to resolve calendar date");
  return `${year}-${month}-${day}`;
}

export function todayKey(timezone = deviceTimezone()): string {
  return dateKeyForInstant(new Date(), timezone);
}

export function monthKeyForDateKey(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [yearText, monthText] = monthKey.split("-");
  const value = new Date(Date.UTC(Number(yearText), Number(monthText) - 1 + delta, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monthKey: string): string {
  const [yearText, monthText] = monthKey.split("-");
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(Number(yearText), Number(monthText) - 1, 15, 12)),
  );
}

export function calendarMonthCells(monthKey: string): Array<string | null> {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leading = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const cells: Array<string | null> = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(`${yearText}-${monthText}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function monthFetchRange(monthKey: string): { from: string; to: string } {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText) - 1;
  return {
    from: new Date(Date.UTC(year, month, 1) - 24 * 60 * 60 * 1000).toISOString(),
    to: new Date(Date.UTC(year, month + 1, 1) + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function localInputToIso(value: string): string {
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new Error("Choose a valid date and time");
  return instant.toISOString();
}

export function isoToLocalInput(iso: string): string {
  const value = new Date(iso);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

export function formatCalendarTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}
