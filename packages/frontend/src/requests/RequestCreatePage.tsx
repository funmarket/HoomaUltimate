import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import { ATHLETES_SPORTS } from "@hooma/contracts/athletes";
import { HELP_CATEGORIES, HELP_ITEM_KINDS } from "@hooma/contracts/help";
import {
  helpRequestCreateSchema,
  type HelpRequestCreateInput,
} from "@hooma/contracts/requests";
import { useHoomaFrontend } from "../context";
import { PlusIcon } from "../help/HelpIcons";
import { createRequestsApi } from "./api";

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function optionalIso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function RequestCreatePage() {
  const { api, transport, protectedError, authenticationHref } = useHoomaFrontend();
  const requestsApi = useMemo(() => createRequestsApi(transport), [transport]);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [publisher, setPublisher] = useState("personal");
  const [audience, setAudience] = useState("public");
  const [category, setCategory] = useState<HelpRequestCreateInput["category"]>("ITEM");
  const [itemKind, setItemKind] = useState("");
  const [sport, setSport] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sizeLabel, setSizeLabel] = useState("");
  const [conditionPreference, setConditionPreference] = useState("");
  const [city, setCity] = useState("");
  const [houma, setHouma] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [neededByAt, setNeededByAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    let active = true;
    void api.identity
      .meOptional()
      .then((current) => {
        if (active) setMe(current);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to load your account"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, protectedError]);

  const publisherOptions = useMemo(() => {
    if (!me) return [];
    return [
      ...me.communities
        .filter((community) => community.role === "FOUNDER" || community.role === "COACH")
        .map((community) => ({ value: `community:${community.id}`, label: `HOOMA · ${community.name}` })),
      ...me.teams
        .filter((team) => team.responsibilities.includes("COACH"))
        .map((team) => ({ value: `team:${team.id}`, label: `Team · ${team.name}` })),
      ...me.athletesCommunities
        .filter((community) => community.role === "FOUNDER" || community.role === "MODERATOR")
        .map((community) => ({ value: `athletes:${community.id}`, label: `Athletes · ${community.name}` })),
    ];
  }, [me]);

  const audienceOptions = useMemo(() => {
    if (!me) return [];
    return [
      ...me.communities.map((community) => ({
        value: `community:${community.id}`,
        label: `HOOMA members · ${community.name}`,
      })),
      ...me.athletesCommunities.map((community) => ({
        value: `athletes:${community.id}`,
        label: `Athletes members · ${community.name}`,
      })),
    ];
  }, [me]);

  function publisherInput(): HelpRequestCreateInput["publisher"] {
    const [kind, id] = publisher.split(":");
    if (!id) return {};
    if (kind === "community") return { publisherCommunityId: id };
    if (kind === "team") return { publisherTeamId: id };
    if (kind === "athletes") return { publisherAthletesCommunityId: id };
    return {};
  }

  function audienceInput(): HelpRequestCreateInput["audience"] {
    const [kind, id] = audience.split(":");
    if (kind === "community" && id) return { scope: "HOOMA_COMMUNITY", communityId: id };
    if (kind === "athletes" && id) {
      return { scope: "ATHLETES_COMMUNITY", athletesCommunityId: id };
    }
    return { scope: "PUBLIC" };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    const candidate = {
      publisher: publisherInput(),
      audience: audienceInput(),
      category,
      itemKind: category === "ITEM" ? optionalText(itemKind) : undefined,
      sport: optionalText(sport),
      title,
      description,
      quantityNeeded: quantity ? Number(quantity) : undefined,
      sizeLabel: optionalText(sizeLabel),
      conditionPreference: optionalText(conditionPreference),
      city: optionalText(city),
      houma: optionalText(houma),
      locationNote: optionalText(locationNote),
      neededByAt: optionalIso(neededByAt),
      expiresAt: optionalIso(expiresAt),
    };
    const parsed = helpRequestCreateSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the Request details");
      return;
    }
    setSaving(true);
    try {
      const created = await requestsApi.create(parsed.data);
      setCreatedId(created.id);
    } catch (reason) {
      setError(protectedError(reason, "Unable to create Request"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="status">Loading account…</p>;
  if (!me) {
    const href = authenticationHref("/requests/new");
    return (
      <section className="page requests-page">
        <div className="requests-empty panel">
          <h1>Create a Request</h1>
          <p className="muted">An HOOMA account is required to publish a Request.</p>
          {href ? <a className="help-primary-action" href={href}>Sign in to continue</a> : null}
          {error ? <p className="status status--error">{error}</p> : null}
        </div>
      </section>
    );
  }

  if (createdId) {
    return (
      <section className="page requests-page">
        <div className="requests-empty panel">
          <span className="eyebrow">REQUEST PUBLISHED</span>
          <h1>Your Request is live.</h1>
          <p className="muted">People who can see its audience can now respond.</p>
          <div className="request-action-row">
            <a className="help-primary-action" href={`/requests/${encodeURIComponent(createdId)}`}>
              View Request
            </a>
            <a className="request-secondary-action" href="/requests">Back to Requests</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="page requests-page">
      <header className="help-hero panel">
        <div>
          <span className="eyebrow">HOOMA HELP</span>
          <h1>Create a Request</h1>
          <p>Describe the need clearly so the right person can respond.</p>
        </div>
      </header>

      <form className="request-form panel" onSubmit={submit}>
        <div className="request-form__grid">
          <label>
            Publish as
            <select value={publisher} onChange={(event) => setPublisher(event.target.value)}>
              <option value="personal">Myself</option>
              {publisherOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Audience
            <select value={audience} onChange={(event) => setAudience(event.target.value)}>
              <option value="public">Everyone</option>
              {audienceOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select value={category} onChange={(event) => setCategory(event.target.value as HelpRequestCreateInput["category"])}>
              {HELP_CATEGORIES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </select>
          </label>
          <label>
            Sport
            <select value={sport} onChange={(event) => setSport(event.target.value)}>
              <option value="">Any / not sport-specific</option>
              {ATHLETES_SPORTS.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </select>
          </label>
          {category === "ITEM" ? (
            <label>
              Item kind
              <select value={itemKind} onChange={(event) => setItemKind(event.target.value)}>
                <option value="">Not specified</option>
                {HELP_ITEM_KINDS.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
              </select>
            </label>
          ) : null}
          <label>
            Quantity
            <input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
          </label>
        </div>

        <label>
          Title
          <input required minLength={3} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What do you need?" />
        </label>
        <label>
          Description
          <textarea required minLength={10} maxLength={1200} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain the need, timing, and anything a responder should know." />
        </label>

        <div className="request-form__grid">
          <label>Size / label<input value={sizeLabel} maxLength={40} onChange={(event) => setSizeLabel(event.target.value)} /></label>
          <label>
            Condition
            <select value={conditionPreference} onChange={(event) => setConditionPreference(event.target.value)}>
              <option value="">Any</option>
              <option value="ANY">Any condition</option>
              <option value="NEW_ONLY">New only</option>
              <option value="USED_OK">Used is okay</option>
            </select>
          </label>
          <label>City<input value={city} maxLength={100} onChange={(event) => setCity(event.target.value)} /></label>
          <label>Houma<input value={houma} maxLength={100} onChange={(event) => setHouma(event.target.value)} /></label>
          <label>Needed by<input type="datetime-local" value={neededByAt} onChange={(event) => setNeededByAt(event.target.value)} /></label>
          <label>Expires at<input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
        </div>
        <label>Location note<input value={locationNote} maxLength={240} onChange={(event) => setLocationNote(event.target.value)} placeholder="Optional meeting or pickup note" /></label>

        {error ? <p className="status status--error">{error}</p> : null}
        <div className="request-action-row">
          <button className="help-primary-action" type="submit" disabled={saving}>
            <PlusIcon /> {saving ? "Publishing…" : "Publish Request"}
          </button>
          <a className="request-secondary-action" href="/requests">Cancel</a>
        </div>
      </form>
    </section>
  );
}
