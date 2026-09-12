import type {
  AthletesCalendarEntry,
  AthletesCalendarEntryCreateInput,
} from "@hooma/contracts/athletes-calendar";
import { useEffect, useState } from "react";
import {
  ATHLETES_CALENDAR_TIMEZONE,
  dateKeyForInstant,
  localDateTimeToIso,
  timeForInstant,
} from "./date";

export function CalendarEntryForm({
  selectedDateKey,
  entry,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  readonly selectedDateKey: string;
  readonly entry: AthletesCalendarEntry | null;
  readonly busy: boolean;
  readonly error: string;
  readonly onSubmit: (input: AthletesCalendarEntryCreateInput) => void;
  readonly onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [dateKey, setDateKey] = useState(selectedDateKey);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("");
  const [locationName, setLocationName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const timezone = entry?.timezone ?? ATHLETES_CALENDAR_TIMEZONE;
    setTitle(entry?.title ?? "");
    setDateKey(entry ? dateKeyForInstant(entry.startsAt, timezone) : selectedDateKey);
    setStartTime(entry ? timeForInstant(entry.startsAt, timezone) : "18:00");
    setEndTime(entry?.endsAt ? timeForInstant(entry.endsAt, timezone) : "");
    setLocationName(entry?.locationName ?? "");
    setDescription(entry?.description ?? "");
  }, [entry, selectedDateKey]);

  const invalidEnd = Boolean(endTime && endTime <= startTime);

  return (
    <form
      className="athletes-calendar-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (invalidEnd) return;
        onSubmit({
          title,
          description: description.trim() || null,
          startsAt: localDateTimeToIso(dateKey, startTime),
          endsAt: endTime ? localDateTimeToIso(dateKey, endTime) : null,
          timezone: ATHLETES_CALENDAR_TIMEZONE,
          locationName: locationName.trim() || null,
        });
      }}
    >
      <div className="athletes-calendar-form__heading">
        <div>
          <span className="eyebrow">{entry ? "EDIT EVENT" : "NEW EVENT"}</span>
          <h3>{entry ? entry.title : "Add to calendar"}</h3>
        </div>
        <button type="button" className="athletes-calendar-form__close" onClick={onClose}>
          ×
          <span className="sr-only">Close event editor</span>
        </button>
      </div>

      <label>
        <span>Event name</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.currentTarget.value)}
          maxLength={120}
          required
          disabled={busy}
        />
      </label>

      <div className="athletes-calendar-form__time-grid">
        <label>
          <span>Date</span>
          <input
            type="date"
            value={dateKey}
            onChange={(event) => setDateKey(event.currentTarget.value)}
            required
            disabled={busy}
          />
        </label>
        <label>
          <span>Starts</span>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.currentTarget.value)}
            required
            disabled={busy}
          />
        </label>
        <label>
          <span>Ends</span>
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.currentTarget.value)}
            disabled={busy}
          />
        </label>
      </div>
      {invalidEnd ? <p className="error-box">End time must be after start time.</p> : null}

      <label>
        <span>Location</span>
        <input
          value={locationName}
          onChange={(event) => setLocationName(event.currentTarget.value)}
          maxLength={160}
          placeholder="Optional"
          disabled={busy}
        />
      </label>

      <label>
        <span>Details</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
          maxLength={1000}
          rows={3}
          placeholder="Optional"
          disabled={busy}
        />
      </label>

      {error ? (
        <div className="error-box" role="alert">
          {error}
        </div>
      ) : null}
      <button className="button athletes-action athletes-action--primary" disabled={busy || invalidEnd}>
        {busy ? "Saving…" : entry ? "Save changes" : "Create event"}
      </button>
    </form>
  );
}
