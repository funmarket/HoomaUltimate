import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import { ATHLETES_SPORTS } from "@hooma/contracts/athletes";
import { HELP_CATEGORIES, HELP_ITEM_KINDS } from "@hooma/contracts/help";
import { helpRequestCreateSchema, type HelpRequestCreateInput } from "@hooma/contracts/requests";
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

/**
 * Request creation. Validation uses the shared helpRequestCreateSchema, publisher
 * and audience choices come from the current MeResponse only, and the backend
 * stays authoritative for publisher/audience authorization.
 */
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
        .map((community) => ({
          value: `community:${community.id}`,
          label: `HOOMA · ${community.name}`,
        })),
      ...me.teams
        .filter((team) => team.responsibilities.includes("COACH"))
        .map((team) => ({ value: `team:${team.id}`, label: `Team · ${team.name}` })),
      ...me.athletesCommunities
        .filter((community) => community.role === "FOUNDER" || community.role === "MODERATOR")
        .map((community) => ({
          value: `athletes:${community.id}`,
          label: `Athletes · ${community.name}`,
        })),
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
    const parsed = helpRequestCreateSchema.safeParse({
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
    });
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
        <section className="requests-empty panel">
          <h1>Create a Request</h1>
          <p className="muted">An HOOMA account is required to publish a Request.</p>
          {href ? (
            <a className="help-action" href={href}>
              Sign in to continue
            </a>
          ) : null}
          {error ? <p className="status request-error">{error}</p> : null}
        </section>
      </section>
    );
  }

  if (createdId) {
    return (
      <section className="page requests-page">
        <section className="requests-empty panel">
          <span className="eyebrow">REQUEST PUBLISHED</span>
          <h1>Your Request is live.</h1>
          <p className="muted">Everyone in its audience can now respond.</p>
          <div className="request-action-row">
            <a className="help-action" href={`/requests/${encodeURIComponent(createdId)}`}>
              View Request
            </a>
            <a className="help-action help-action--quiet" href="/requests">
              Back to Requests
            </a>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="page requests-page">
      <header className="help-hero panel">
        <div className="help-hero__copy">
          <span className="eyebrow">HOOMA HELP</span>
          <h1>Create a Request</h1>
          <p>Describe the need clearly so the right person can respond.</p>
        </div>
      </header>

      <form className="request-form panel" onSubmit={submit}>
        <div className="request-form__grid">
          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-publisher">
              Publish as
            </label>
            <select
              id="request-create-publisher"
              className="request-field__control"
              value={publisher}
              onChange={(event) => setPublisher(event.target.value)}
            >
              <option value="personal">Myself</option>
              {publisherOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-audience">
              Audience
            </label>
            <select
              id="request-create-audience"
              className="request-field__control"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
            >
              <option value="public">Everyone</option>
              {audienceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-category">
              Category
            </label>
            <select
              id="request-create-category"
              className="request-field__control"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as HelpRequestCreateInput["category"])
              }
            >
              {HELP_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </div>

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-sport">
              Sport
            </label>
            <select
              id="request-create-sport"
              className="request-field__control"
              value={sport}
              onChange={(event) => setSport(event.target.value)}
            >
              <option value="">Any / not sport-specific</option>
              {ATHLETES_SPORTS.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </div>

          {category === "ITEM" ? (
            <div className="request-field">
              <label className="request-field__label" htmlFor="request-create-item-kind">
                Item kind
              </label>
              <select
                id="request-create-item-kind"
                className="request-field__control"
                value={itemKind}
                onChange={(event) => setItemKind(event.target.value)}
              >
                <option value="">Not specified</option>
                {HELP_ITEM_KINDS.map((value) => (
                  <option key={value} value={value}>
                    {titleCase(value)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-quantity">
              Quantity
            </label>
            <input
              id="request-create-quantity"
              className="request-field__control"
              type="number"
              min="1"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
            />
          </div>
        </div>

        <label className="request-field__label" htmlFor="request-create-title">
          Title
        </label>
        <input
          id="request-create-title"
          className="request-field__control"
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <label className="request-field__label" htmlFor="request-create-description">
          Description
        </label>
        <textarea
          id="request-create-description"
          maxLength={1200}
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div className="request-form__grid">
          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-size">
              Size / label
            </label>
            <input
              id="request-create-size"
              className="request-field__control"
              maxLength={40}
              value={sizeLabel}
              onChange={(event) => setSizeLabel(event.target.value)}
            />
          </div>

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-condition">
              Condition
            </label>
            <select
              id="request-create-condition"
              className="request-field__control"
              value={conditionPreference}
              onChange={(event) => setConditionPreference(event.target.value)}
            >
              <option value="">Any</option>
              <option value="ANY">Any condition</option>
              <option value="NEW_ONLY">New only</option>
              <option value="USED_OK">Used is okay</option>
            </select>
          </div>

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-city">
              City
            </label>
            <input
              id="request-create-city"
              className="request-field__control"
              maxLength={100}
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />
          </div>

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-houma">
              Houma
            </label>
            <input
              id="request-create-houma"
              className="request-field__control"
              maxLength={100}
              value={houma}
              onChange={(event) => setHouma(event.target.value)}
            />
          </div>

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-needed-by">
              Needed by
            </label>
            <input
              id="request-create-needed-by"
              className="request-field__control"
              type="datetime-local"
              value={neededByAt}
              onChange={(event) => setNeededByAt(event.target.value)}
            />
          </div>

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-expires">
              Expires at
            </label>
            <input
              id="request-create-expires"
              className="request-field__control"
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>
        </div>

        <label className="request-field__label" htmlFor="request-create-location-note">
          Location note
        </label>
        <input
          id="request-create-location-note"
          className="request-field__control"
          maxLength={240}
          value={locationNote}
          onChange={(event) => setLocationNote(event.target.value)}
        />

        {error ? <p className="status request-error">{error}</p> : null}

        <div className="request-action-row">
          <button className="help-action" type="submit" disabled={saving}>
            <PlusIcon />
            <span>{saving ? "Publishing…" : "Publish Request"}</span>
          </button>
          <a className="help-action help-action--quiet" href="/requests">
            Cancel
          </a>
        </div>
      </form>
    </section>
  );
}
