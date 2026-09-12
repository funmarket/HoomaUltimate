import { buildMonthDays } from "./date";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function MonthGrid({
  monthKey,
  selectedKey,
  todayKey,
  eventCounts,
  onSelect,
}: {
  readonly monthKey: string;
  readonly selectedKey: string;
  readonly todayKey: string;
  readonly eventCounts: ReadonlyMap<string, number>;
  readonly onSelect: (dateKey: string) => void;
}) {
  return (
    <div className="athletes-calendar-grid" aria-label="Calendar month">
      {WEEKDAYS.map((weekday) => (
        <span className="athletes-calendar-weekday" key={weekday} aria-hidden="true">
          {weekday}
        </span>
      ))}
      {buildMonthDays(monthKey).map((day) => {
        const count = eventCounts.get(day.key) ?? 0;
        const selected = day.key === selectedKey;
        const today = day.key === todayKey;
        return (
          <button
            key={day.key}
            type="button"
            className="athletes-calendar-day"
            data-outside-month={day.inMonth ? undefined : "true"}
            data-selected={selected ? "true" : undefined}
            data-today={today ? "true" : undefined}
            aria-pressed={selected}
            aria-label={`${day.key}${count ? `, ${count} scheduled ${count === 1 ? "event" : "events"}` : ""}`}
            onClick={() => onSelect(day.key)}
          >
            <span>{day.day}</span>
            {count ? (
              <span className="athletes-calendar-day__events" aria-hidden="true">
                {count > 3 ? "3+" : "•".repeat(count)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
