import type { AthletesCalendarEntry } from "@hooma/contracts/athletes-calendar";
import { dayHeading, timeForInstant } from "./date";

export function DayAgenda({
  dateKey,
  entries,
  founder,
  busy,
  onEdit,
  onCancel,
}: {
  readonly dateKey: string;
  readonly entries: readonly AthletesCalendarEntry[];
  readonly founder: boolean;
  readonly busy: boolean;
  readonly onEdit: (entry: AthletesCalendarEntry) => void;
  readonly onCancel: (entry: AthletesCalendarEntry) => void;
}) {
  return (
    <div className="athletes-calendar-agenda">
      <div className="athletes-calendar-agenda__heading">
        <span className="eyebrow">SELECTED DAY</span>
        <h3>{dayHeading(dateKey)}</h3>
      </div>
      {entries.length ? (
        <div className="athletes-calendar-agenda__list">
          {entries.map((entry) => (
            <details
              className="athletes-calendar-event"
              data-cancelled={entry.status === "CANCELLED" ? "true" : undefined}
              key={entry.id}
            >
              <summary>
                <span className="athletes-calendar-event__time">
                  {timeForInstant(entry.startsAt, entry.timezone)}
                </span>
                <span className="athletes-calendar-event__summary">
                  <strong>{entry.title}</strong>
                  <small>
                    {entry.status === "CANCELLED"
                      ? "Cancelled"
                      : entry.locationName || "Tap for details"}
                  </small>
                </span>
                <span aria-hidden="true">⌄</span>
              </summary>
              <div className="athletes-calendar-event__detail">
                <p>
                  <strong>Time</strong>
                  <span>
                    {timeForInstant(entry.startsAt, entry.timezone)}
                    {entry.endsAt ? ` – ${timeForInstant(entry.endsAt, entry.timezone)}` : ""}
                  </span>
                </p>
                {entry.locationName ? (
                  <p>
                    <strong>Location</strong>
                    <span>{entry.locationName}</span>
                  </p>
                ) : null}
                {entry.description ? (
                  <p>
                    <strong>Details</strong>
                    <span>{entry.description}</span>
                  </p>
                ) : null}
                {founder && entry.status === "SCHEDULED" ? (
                  <div className="athletes-calendar-event__actions">
                    <button type="button" disabled={busy} onClick={() => onEdit(entry)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="athletes-calendar-event__cancel"
                      disabled={busy}
                      onClick={() => onCancel(entry)}
                    >
                      Cancel event
                    </button>
                  </div>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="muted athletes-calendar-empty">No events scheduled for this day.</p>
      )}
    </div>
  );
}
