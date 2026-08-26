import { type FormEvent } from "react";
import type { PublicPlaceSummary } from "@hooma/contracts/platform-management";
import type { WatchEventDetailsInput } from "@hooma/contracts";
import type { PublicEvent } from "./api";

export type WatchEventFormValue = {
  placeId?: string;
  watch: WatchEventDetailsInput;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
};

function localDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function WatchEventForm({
  places,
  initialEvent,
  submitLabel,
  pending,
  lockPlace = false,
  onSubmit,
}: {
  readonly places: readonly PublicPlaceSummary[];
  readonly initialEvent?: PublicEvent | null;
  readonly submitLabel: string;
  readonly pending: boolean;
  readonly lockPlace?: boolean;
  readonly onSubmit: (value: WatchEventFormValue) => Promise<void>;
}) {
  const watch = initialEvent?.watchDetails;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const optionalText = (name: string) => String(data.get(name) ?? "").trim() || null;
    const capacityValue = String(data.get("capacity") ?? "").trim();
    await onSubmit({
      placeId: lockPlace ? undefined : String(data.get("placeId") ?? ""),
      watch: {
        teamOneName: String(data.get("teamOneName") ?? "").trim(),
        teamOneLogoUrl: optionalText("teamOneLogoUrl"),
        teamTwoName: String(data.get("teamTwoName") ?? "").trim(),
        teamTwoLogoUrl: optionalText("teamTwoLogoUrl"),
      },
      description: optionalText("description"),
      startsAt: new Date(String(data.get("startsAt") ?? "")).toISOString(),
      endsAt: optionalText("endsAt")
        ? new Date(String(data.get("endsAt") ?? "")).toISOString()
        : null,
      capacity: capacityValue ? Number(capacityValue) : null,
    });
  }

  return (
    <form className="hooma-form watch-event-form" onSubmit={(event) => void submit(event)}>
      {!lockPlace ? (
        <section className="hooma-form__section">
          <div className="hooma-form__section-heading">
            <span>01</span>
            <div>
              <h2>Place</h2>
              <p>Choose the approved Place hosting this Watch event.</p>
            </div>
          </div>
          <label className="hooma-field">
            <span>Place *</span>
            <select name="placeId" defaultValue={initialEvent?.placeId ?? ""} required>
              <option value="">Select a Place</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name} ·{" "}
                  {[place.houma, place.city].filter(Boolean).join(", ") || place.address}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      <section className="hooma-form__section">
        <div className="hooma-form__section-heading">
          <span>{lockPlace ? "01" : "02"}</span>
          <div>
            <h2>Match</h2>
            <p>Team names anchor the collector ticket. Logos stay clear on each side.</p>
          </div>
        </div>
        <div className="watch-match-form">
          <div className="watch-team-form">
            <label className="hooma-field">
              <span>Team 1 *</span>
              <input name="teamOneName" defaultValue={watch?.teamOneName ?? ""} required />
            </label>
            <label className="hooma-field">
              <span>Team 1 logo URL</span>
              <input
                name="teamOneLogoUrl"
                type="url"
                maxLength={4000}
                defaultValue={watch?.teamOneLogoUrl ?? ""}
                placeholder="https://…"
              />
            </label>
          </div>
          <div className="watch-match-form__versus">VS</div>
          <div className="watch-team-form">
            <label className="hooma-field">
              <span>Team 2 *</span>
              <input name="teamTwoName" defaultValue={watch?.teamTwoName ?? ""} required />
            </label>
            <label className="hooma-field">
              <span>Team 2 logo URL</span>
              <input
                name="teamTwoLogoUrl"
                type="url"
                maxLength={4000}
                defaultValue={watch?.teamTwoLogoUrl ?? ""}
                placeholder="https://…"
              />
            </label>
          </div>
        </div>
        <label className="hooma-field">
          <span>Event note</span>
          <textarea
            name="description"
            rows={4}
            defaultValue={initialEvent?.description ?? ""}
            placeholder="Optional match-night information"
          />
        </label>
      </section>

      <section className="hooma-form__section">
        <div className="hooma-form__section-heading">
          <span>{lockPlace ? "02" : "03"}</span>
          <div>
            <h2>When</h2>
            <p>Set the event time and optional capacity.</p>
          </div>
        </div>
        <div className="hooma-form__grid">
          <label className="hooma-field">
            <span>Starts *</span>
            <input
              name="startsAt"
              type="datetime-local"
              defaultValue={localDateTime(initialEvent?.startsAt)}
              required
            />
          </label>
          <label className="hooma-field">
            <span>Ends</span>
            <input
              name="endsAt"
              type="datetime-local"
              defaultValue={localDateTime(initialEvent?.endsAt)}
            />
          </label>
        </div>
        <label className="hooma-field">
          <span>Capacity</span>
          <input
            name="capacity"
            type="number"
            min="1"
            max="1000"
            defaultValue={initialEvent?.capacity ?? ""}
            placeholder="Unlimited"
          />
        </label>
      </section>

      <button className="hooma-form__submit" type="submit" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
