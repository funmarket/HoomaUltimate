import type { AthletesSport, AthletesPublicDetail } from "@hooma/contracts/athletes";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useHoomaFrontend } from "../context";
import { sports, sportLabel } from "./sports";

export function AthletesCommunityForm({
  community,
  onSaved,
  onCancel,
}: {
  readonly community?: AthletesPublicDetail;
  readonly onSaved: (id: string) => void;
  readonly onCancel: () => void;
}) {
  const { api, protectedError } = useHoomaFrontend();
  const [sport, setSport] = useState<AthletesSport>(community?.sport ?? "RUNNING");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">(
    community?.visibility ?? "PUBLIC",
  );
  const [joinPolicy, setJoinPolicy] = useState<"OPEN" | "APPROVAL_REQUIRED">(
    community?.joinPolicy ?? "OPEN",
  );
  const submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    const data = new FormData(event.currentTarget);
    setCreating(true);
    setError("");
    try {
      const input = {
        name: String(data.get("name")).trim(),
        sport,
        description: String(data.get("description")).trim() || null,
        city: String(data.get("city")).trim() || null,
        houma: String(data.get("houma")).trim() || null,
        logoUrl: String(data.get("logoUrl")).trim() || null,
        bannerUrl: String(data.get("bannerUrl")).trim() || null,
        visibility,
        joinPolicy: visibility === "PRIVATE" ? "APPROVAL_REQUIRED" : joinPolicy,
      };
      const saved = community
        ? await api.athletes.update(community.id, input)
        : await api.athletes.create(input);
      if (mounted.current) onSaved(saved.id);
    } catch (reason) {
      if (mounted.current) setError(protectedError(reason, "Unable to save Athletes community"));
    } finally {
      submitting.current = false;
      if (mounted.current) setCreating(false);
    }
  }

  return (
    <div className="page athletes-page athletes-create-page" data-sport={sport}>
      <button type="button" className="team-management-back athletes-back" onClick={onCancel}>
        ← Back
      </button>
      <section className="athletes-surface athletes-hero athletes-hero--create" data-sport={sport}>
        <span className="athletes-card__motif" aria-hidden="true" />
        <div className="athletes-hero__content">
          <span className="eyebrow">{community ? "COMMUNITY SETTINGS" : "CREATE ATHLETES"}</span>
          <h1>
            {community ? `Edit ${community.name}` : `Build your ${sportLabel(sport)} circle.`}
          </h1>
          <p>Choose the sport first. The community carries that identity from creation onward.</p>
        </div>
      </section>
      {error ? <div className="error-box">{error}</div> : null}
      <form className="athletes-surface athletes-create-form" onSubmit={submit}>
        <fieldset className="athletes-sport-picker">
          <legend>Choose a sport</legend>
          <div
            className="athletes-sport-picker__grid"
            role="radiogroup"
            aria-label="Choose a sport"
          >
            {sports.map((option) => (
              <label
                className={
                  sport === option.value
                    ? "athletes-sport-option is-selected"
                    : "athletes-sport-option"
                }
                data-sport={option.value}
                key={option.value}
              >
                <input
                  type="radio"
                  name="sportChoice"
                  value={option.value}
                  aria-label={option.label}
                  checked={sport === option.value}
                  onChange={() => setSport(option.value)}
                />
                <span className="athletes-sport-option__motif" aria-hidden="true" />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="athletes-form-grid">
          <label className="athletes-field">
            <span>Name</span>
            <input
              name="name"
              defaultValue={community?.name ?? ""}
              required
              minLength={2}
              maxLength={100}
              placeholder="Community name"
            />
          </label>
          <label className="athletes-field">
            <span>City</span>
            <input
              name="city"
              defaultValue={community?.city ?? ""}
              maxLength={100}
              placeholder="City"
            />
          </label>
          <label className="athletes-field">
            <span>HOUMA / neighborhood</span>
            <input
              name="houma"
              defaultValue={community?.houma ?? ""}
              maxLength={100}
              placeholder="Area or neighborhood"
            />
          </label>
          <label className="athletes-field">
            <span>Logo URL</span>
            <input
              name="logoUrl"
              defaultValue={community?.logoUrl ?? ""}
              type="url"
              maxLength={2000}
              placeholder="https://…"
            />
          </label>
          <label className="athletes-field athletes-span-2">
            <span>Banner image URL</span>
            <input
              name="bannerUrl"
              defaultValue={community?.bannerUrl ?? ""}
              type="url"
              maxLength={2000}
              placeholder="https://…"
            />
          </label>
          <label className="athletes-field athletes-span-2">
            <span>Description</span>
            <textarea
              name="description"
              defaultValue={community?.description ?? ""}
              maxLength={600}
              rows={4}
              placeholder="What brings this community together?"
            />
          </label>
        </div>

        <fieldset className="athletes-choice-grid">
          <legend>Discovery and joining</legend>
          <label
            className={
              visibility === "PUBLIC"
                ? "athletes-choice-option is-selected"
                : "athletes-choice-option"
            }
          >
            <input
              type="radio"
              name="visibility"
              aria-label="Public"
              checked={visibility === "PUBLIC"}
              onChange={() => setVisibility("PUBLIC")}
            />
            <span>
              <strong>Public</strong>
              <small>People can discover this Athletes community.</small>
            </span>
          </label>
          <label
            className={
              visibility === "PRIVATE"
                ? "athletes-choice-option is-selected"
                : "athletes-choice-option"
            }
          >
            <input
              type="radio"
              name="visibility"
              aria-label="Private"
              checked={visibility === "PRIVATE"}
              onChange={() => {
                setVisibility("PRIVATE");
                setJoinPolicy("APPROVAL_REQUIRED");
              }}
            />
            <span>
              <strong>Private</strong>
              <small>Discovery stays privacy-safe and joining requires approval.</small>
            </span>
          </label>
          <label
            className={
              joinPolicy === "OPEN" && visibility === "PUBLIC"
                ? "athletes-choice-option is-selected"
                : "athletes-choice-option"
            }
          >
            <input
              type="radio"
              name="joinPolicy"
              aria-label="Open join"
              checked={joinPolicy === "OPEN" && visibility === "PUBLIC"}
              disabled={visibility === "PRIVATE"}
              onChange={() => setJoinPolicy("OPEN")}
            />
            <span>
              <strong>Open join</strong>
              <small>Authenticated users can join immediately.</small>
            </span>
          </label>
          <label
            className={
              joinPolicy === "APPROVAL_REQUIRED"
                ? "athletes-choice-option is-selected"
                : "athletes-choice-option"
            }
          >
            <input
              type="radio"
              name="joinPolicy"
              aria-label="Approval required"
              checked={joinPolicy === "APPROVAL_REQUIRED"}
              onChange={() => setJoinPolicy("APPROVAL_REQUIRED")}
            />
            <span>
              <strong>Approval required</strong>
              <small>Founders or moderators review requests.</small>
            </span>
          </label>
        </fieldset>
        <div className="athletes-form-actions">
          <button
            type="button"
            className="button secondary athletes-action athletes-action--secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button className="button athletes-action athletes-action--primary" disabled={creating}>
            <span className="athletes-action__icon" aria-hidden="true">
              +
            </span>
            {creating ? "Saving…" : community ? "Save changes" : "Create community"}
          </button>
        </div>
      </form>
    </div>
  );
}
