import { useState, type FormEvent } from "react";
import type { WatchEventDetailsInput, WatchEventKind } from "@hooma/contracts";
import type { PublicPlaceSummary } from "@hooma/contracts/places";
import type { PublicEvent } from "./api";

export type WatchEventFormValue = {
  placeId?: string;
  title: string;
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
  initialKind = "MATCH",
  initialPlaceId = "",
  submitLabel,
  pending,
  lockPlace = false,
  onSubmit,
}: {
  readonly places: readonly PublicPlaceSummary[];
  readonly initialEvent?: PublicEvent | null;
  readonly initialKind?: WatchEventKind;
  readonly initialPlaceId?: string;
  readonly submitLabel: string;
  readonly pending: boolean;
  readonly lockPlace?: boolean;
  readonly onSubmit: (value: WatchEventFormValue) => Promise<void>;
}) {
  const initialWatch = initialEvent?.watchDetails;
  const [kind, setKind] = useState<WatchEventKind>(initialWatch?.kind ?? initialKind);
  const kindLocked = Boolean(initialEvent);
  const match = initialWatch?.kind === "MATCH" ? initialWatch : null;
  const cultural = initialWatch?.kind === "CULTURAL" ? initialWatch : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const optionalText = (name: string) => String(data.get(name) ?? "").trim() || null;
    const capacityValue = String(data.get("capacity") ?? "").trim();
    const watch: WatchEventDetailsInput =
      kind === "MATCH"
        ? {
            kind: "MATCH",
            teamOneName: String(data.get("teamOneName") ?? "").trim(),
            teamOneLogoUrl: optionalText("teamOneLogoUrl"),
            teamTwoName: String(data.get("teamTwoName") ?? "").trim(),
            teamTwoLogoUrl: optionalText("teamTwoLogoUrl"),
          }
        : {
            kind: "CULTURAL",
            culturalCategory: String(data.get("culturalCategory")) as
              "MUSIC" | "CONCERT" | "COMEDY" | "ART" | "SCREENING" | "FOOD" | "COMMUNITY" | "OTHER",
            imageUrl: optionalText("culturalImageUrl"),
          };
    const title =
      kind === "MATCH"
        ? `${watch.kind === "MATCH" ? watch.teamOneName : ""} vs ${watch.kind === "MATCH" ? watch.teamTwoName : ""}`
        : String(data.get("title") ?? "").trim();
    await onSubmit({
      ...(lockPlace ? {} : { placeId: String(data.get("placeId") ?? "") }),
      title,
      watch,
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
      <section className="hooma-form__section">
        <div className="hooma-form__section-heading">
          <span>01</span>
          <div>
            <h2>Watch type</h2>
            <p>Choose the experience supporters will discover on Watch.</p>
          </div>
        </div>
        <div className="watch-kind-selector" role="group" aria-label="Watch event type">
          <button
            type="button"
            className={
              kind === "MATCH"
                ? "watch-kind-selector__option is-active"
                : "watch-kind-selector__option"
            }
            aria-pressed={kind === "MATCH"}
            disabled={kindLocked}
            onClick={() => setKind("MATCH")}
          >
            Match
          </button>
          <button
            type="button"
            className={
              kind === "CULTURAL"
                ? "watch-kind-selector__option is-active"
                : "watch-kind-selector__option"
            }
            aria-pressed={kind === "CULTURAL"}
            disabled={kindLocked}
            onClick={() => setKind("CULTURAL")}
          >
            Cultural
          </button>
        </div>
        {kind === "CULTURAL" ? (
          <p className="muted">
            Cultural events can only be published by a verified owner of the selected Place.
          </p>
        ) : null}
      </section>

      {!lockPlace ? (
        <section className="hooma-form__section">
          <div className="hooma-form__section-heading">
            <span>02</span>
            <div>
              <h2>Place</h2>
              <p>Choose the approved Place hosting this Watch event.</p>
            </div>
          </div>
          <label className="hooma-field">
            <span>Place *</span>
            <select name="placeId" defaultValue={initialEvent?.placeId ?? initialPlaceId} required>
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
          <span>{lockPlace ? "02" : "03"}</span>
          <div>
            <h2>{kind === "MATCH" ? "Match" : "Cultural event"}</h2>
            <p>
              {kind === "MATCH"
                ? "Team names anchor the collector ticket. Logos stay clear on each side."
                : "Give the event a clear title, category and optional external poster image."}
            </p>
          </div>
        </div>
        {kind === "MATCH" ? (
          <div className="watch-match-form">
            <div className="watch-team-form">
              <label className="hooma-field">
                <span>Team 1 *</span>
                <input name="teamOneName" defaultValue={match?.teamOneName ?? ""} required />
              </label>
              <label className="hooma-field">
                <span>Team 1 logo URL</span>
                <input
                  name="teamOneLogoUrl"
                  type="url"
                  maxLength={4000}
                  defaultValue={match?.teamOneLogoUrl ?? ""}
                  placeholder="https://…"
                />
              </label>
            </div>
            <div className="watch-match-form__versus">VS</div>
            <div className="watch-team-form">
              <label className="hooma-field">
                <span>Team 2 *</span>
                <input name="teamTwoName" defaultValue={match?.teamTwoName ?? ""} required />
              </label>
              <label className="hooma-field">
                <span>Team 2 logo URL</span>
                <input
                  name="teamTwoLogoUrl"
                  type="url"
                  maxLength={4000}
                  defaultValue={match?.teamTwoLogoUrl ?? ""}
                  placeholder="https://…"
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="watch-cultural-form">
            <label className="hooma-field">
              <span>Event title *</span>
              <input
                name="title"
                maxLength={220}
                defaultValue={initialEvent?.title ?? ""}
                required
              />
            </label>
            <div className="hooma-form__grid">
              <label className="hooma-field">
                <span>Category *</span>
                <select
                  name="culturalCategory"
                  defaultValue={cultural?.culturalCategory ?? "MUSIC"}
                  required
                >
                  <option value="MUSIC">Music</option>
                  <option value="CONCERT">Concert</option>
                  <option value="COMEDY">Comedy</option>
                  <option value="ART">Art</option>
                  <option value="SCREENING">Screening</option>
                  <option value="FOOD">Food</option>
                  <option value="COMMUNITY">Community</option>
                  <option value="OTHER">Other</option>
                </select>
              </label>
              <label className="hooma-field">
                <span>Poster image URL</span>
                <input
                  name="culturalImageUrl"
                  type="url"
                  maxLength={4000}
                  defaultValue={cultural?.imageUrl ?? ""}
                  placeholder="https://…"
                />
              </label>
            </div>
          </div>
        )}
        <label className="hooma-field">
          <span>Event note</span>
          <textarea
            name="description"
            rows={4}
            defaultValue={initialEvent?.description ?? ""}
            placeholder={
              kind === "MATCH" ? "Optional match-night information" : "What should guests know?"
            }
          />
        </label>
      </section>

      <section className="hooma-form__section">
        <div className="hooma-form__section-heading">
          <span>{lockPlace ? "03" : "04"}</span>
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
