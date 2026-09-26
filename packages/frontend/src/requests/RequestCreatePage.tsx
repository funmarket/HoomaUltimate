import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import type { HelpTaxonomyResponse, HelpTaxonomySurface } from "@hooma/contracts/help-taxonomy";
import {
  helpRequestCreateSchema,
  helpRequestExternalImageInputSchema,
  type HelpRequestCreateInput,
} from "@hooma/contracts/requests";
import { useHoomaFrontend } from "../context";
import { PlusIcon } from "../help/HelpIcons";
import { createRequestsApi } from "./api";

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
  const taxonomySurface = useMemo<HelpTaxonomySurface>(() => {
    if (typeof window === "undefined") return "REQUESTS";
    const surface = new URLSearchParams(window.location.search).get("surface");
    return surface === "PLAY" || surface === "ATHLETES" ? surface : "REQUESTS";
  }, []);
  const createHref =
    taxonomySurface === "REQUESTS" ? "/requests/new" : `/requests/new?surface=${taxonomySurface}`;
  const returnHref =
    taxonomySurface === "PLAY"
      ? "/play"
      : taxonomySurface === "ATHLETES"
        ? "/athletes?tab=requests"
        : "/requests";
  const returnLabel =
    taxonomySurface === "PLAY"
      ? "Back to Play"
      : taxonomySurface === "ATHLETES"
        ? "Back to Athletes"
        : "Back to Requests";
  const introduction =
    taxonomySurface === "PLAY"
      ? "Create a Football Request for Play."
      : taxonomySurface === "ATHLETES"
        ? "Create a sport Request with the Athletes taxonomy."
        : "Ask the community for help around sport or community needs.";
  const [me, setMe] = useState<MeResponse | null>(null);
  const [taxonomy, setTaxonomy] = useState<HelpTaxonomyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [publisher, setPublisher] = useState("personal");
  const [audience, setAudience] = useState("public");
  const [requestType, setRequestType] = useState(taxonomySurface === "REQUESTS" ? "" : "SPORT");
  const [sport, setSport] = useState(taxonomySurface === "PLAY" ? "FOOTBALL" : "");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [needId, setNeedId] = useState("");
  const [customNeed, setCustomNeed] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sizeLabel, setSizeLabel] = useState("");
  const [conditionPreference, setConditionPreference] = useState("");
  const [city, setCity] = useState("");
  const [houma, setHouma] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [neededByAt, setNeededByAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([api.identity.meOptional(), requestsApi.taxonomy(taxonomySurface)])
      .then(([current, currentTaxonomy]) => {
        if (!active) return;
        setMe(current);
        setTaxonomy(currentTaxonomy);
      })
      .catch((reason) => {
        if (active) setError(protectedError(reason, "Unable to load Request setup"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [api, protectedError, requestsApi, taxonomySurface]);

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

  const selectedSport =
    requestType === "SPORT" ? taxonomy?.sports.find((entry) => entry.sport === sport) : undefined;
  const selectedSubcategories =
    requestType === "COMMUNITY"
      ? (taxonomy?.community.subcategories ?? [])
      : (selectedSport?.subcategories ?? []);
  const selectedSubcategory = selectedSubcategories.find((entry) => entry.id === subcategoryId);
  const selectedNeed = selectedSubcategory?.needs.find((entry) => entry.id === needId);
  const productNeed = selectedNeed?.kind === "PRODUCT";
  const taxonomyComplete = Boolean(
    selectedNeed && (!selectedNeed.allowsCustomText || optionalText(customNeed)),
  );

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
    if (kind === "community" && id) {
      return { scope: "HOOMA_COMMUNITY", communityId: id };
    }
    if (kind === "athletes" && id) {
      return { scope: "ATHLETES_COMMUNITY", athletesCommunityId: id };
    }
    return { scope: "PUBLIC" };
  }

  function clearNeedDetails() {
    setNeedId("");
    setCustomNeed("");
    setQuantity("");
    setSizeLabel("");
    setConditionPreference("");
  }

  function selectRequestType(nextRequestType: "SPORT" | "COMMUNITY") {
    if (taxonomySurface !== "REQUESTS" || requestType === nextRequestType) return;
    setRequestType(nextRequestType);
    setSport("");
    setSubcategoryId("");
    clearNeedDetails();
  }

  async function attachSelectedImage(requestId: string): Promise<void> {
    if (imageFile) {
      await requestsApi.uploadImage(requestId, imageFile, imageFile.type);
      return;
    }
    const externalUrl = optionalText(imageUrl);
    if (externalUrl) {
      await requestsApi.setExternalImage(requestId, { url: externalUrl });
    }
  }

  async function retryImage(): Promise<void> {
    if (!createdId || saving) return;
    setSaving(true);
    setMediaError("");
    try {
      await attachSelectedImage(createdId);
    } catch {
      setMediaError("Request created, but the image could not be uploaded.");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setError("");
    setMediaError("");
    const parsed = helpRequestCreateSchema.safeParse({
      publisher: publisherInput(),
      audience: audienceInput(),
      requestType: requestType || undefined,
      sport: requestType === "SPORT" ? sport || undefined : undefined,
      subcategoryId: subcategoryId || undefined,
      needId: needId || undefined,
      customNeed: selectedNeed?.allowsCustomText ? optionalText(customNeed) : undefined,
      title,
      description,
      quantityNeeded: productNeed && quantity ? Number(quantity) : undefined,
      sizeLabel: productNeed ? optionalText(sizeLabel) : undefined,
      conditionPreference: productNeed ? optionalText(conditionPreference) : undefined,
      city: optionalText(city),
      houma: optionalText(houma),
      fullAddress: optionalText(fullAddress),
      locationNote: optionalText(locationNote),
      neededByAt: optionalIso(neededByAt),
      expiresAt: optionalIso(expiresAt),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the Request details");
      return;
    }

    const externalImage = optionalText(imageUrl);
    if (externalImage) {
      const parsedImage = helpRequestExternalImageInputSchema.safeParse({ url: externalImage });
      if (!parsedImage.success) {
        setError(parsedImage.error.issues[0]?.message ?? "Check the image URL");
        return;
      }
    }

    setSaving(true);
    try {
      const created = await requestsApi.create(parsed.data);
      setCreatedId(created.id);
      if (imageFile || externalImage) {
        try {
          await attachSelectedImage(created.id);
        } catch {
          setMediaError("Request created, but the image could not be uploaded.");
        }
      }
    } catch (reason) {
      setError(protectedError(reason, "Unable to create Request"));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="status">Loading Request setup…</p>;

  if (!me) {
    const href = authenticationHref(createHref);
    return (
      <section className="page requests-page">
        <section className="requests-empty panel">
          <h1>Create a Request</h1>
          <p className="muted">An HOOMA account is required to publish a Request.</p>
          {href ? (
            <a className="help-action help-action--primary" href={href}>
              Sign in to continue
            </a>
          ) : null}
          {error ? <p className="status request-error">{error}</p> : null}
        </section>
      </section>
    );
  }

  if (!taxonomy) {
    return <p className="status request-error">{error || "Request categories are unavailable"}</p>;
  }

  if (createdId) {
    return (
      <section className="page requests-page">
        <section className="requests-empty panel">
          <span className="eyebrow">REQUEST PUBLISHED</span>
          <h1>Your Request is live.</h1>
          <p className="muted">Everyone in its audience can now respond.</p>
          {mediaError ? <p className="status request-error">{mediaError}</p> : null}
          <div className="request-action-row">
            {mediaError ? (
              <button
                className="help-action"
                type="button"
                disabled={saving}
                onClick={() => void retryImage()}
              >
                {saving ? "Retrying…" : "Retry image"}
              </button>
            ) : null}
            <a
              className="help-action help-action--primary"
              href={`/requests/${encodeURIComponent(createdId)}`}
            >
              View Request
            </a>
            <a className="help-action help-action--quiet" href={returnHref}>
              {returnLabel}
            </a>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="page requests-page">
      <header className="help-hero">
        <div className="help-hero__copy">
          <span className="eyebrow">REQUESTS</span>
          <h1>New Request</h1>
          <p>{introduction}</p>
        </div>
      </header>

      <form className="request-form" onSubmit={submit}>
        <section className="request-form__section">
          <div className="request-form__section-header">
            <h2>What do you need?</h2>
            <p>Choose the Request taxonomy first, then add the remaining details.</p>
          </div>
          <div className="request-form__grid">
            {taxonomySurface === "REQUESTS" ? (
              <div className="request-field request-field--full">
                <span className="request-field__label">Request type</span>
                <div className="request-create-root-switch" role="group" aria-label="Request type">
                  <button
                    type="button"
                    aria-pressed={requestType === "SPORT"}
                    onClick={() => selectRequestType("SPORT")}
                  >
                    Sport
                  </button>
                  <button
                    type="button"
                    aria-pressed={requestType === "COMMUNITY"}
                    onClick={() => selectRequestType("COMMUNITY")}
                  >
                    Community
                  </button>
                </div>
              </div>
            ) : (
              <div className="request-create-context request-field--full" role="status">
                <strong>
                  {taxonomySurface === "PLAY" ? "Football Request" : "Athletes Sport Request"}
                </strong>
                <span>
                  {taxonomySurface === "PLAY"
                    ? "This Request is locked to Sport and Football for Play."
                    : "This Request is locked to Sport; choose an available non-Football sport."}
                </span>
              </div>
            )}

            {requestType === "SPORT" && taxonomySurface !== "PLAY" ? (
              <div className="request-field">
                <label className="request-field__label" htmlFor="request-create-sport">
                  Sport
                </label>
                <select
                  id="request-create-sport"
                  className="request-field__control"
                  value={sport}
                  required
                  onChange={(event) => {
                    setSport(event.target.value);
                    setSubcategoryId("");
                    clearNeedDetails();
                  }}
                >
                  <option value="">Choose sport</option>
                  {taxonomy.sports.map((entry) => (
                    <option key={entry.sport} value={entry.sport}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {requestType === "COMMUNITY" || selectedSport ? (
              <div className="request-field">
                <label className="request-field__label" htmlFor="request-create-subcategory">
                  Category
                </label>
                <select
                  id="request-create-subcategory"
                  className="request-field__control"
                  value={subcategoryId}
                  required
                  onChange={(event) => {
                    setSubcategoryId(event.target.value);
                    clearNeedDetails();
                  }}
                >
                  <option value="">Choose category</option>
                  {selectedSubcategories.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {selectedSubcategory ? (
              <div className="request-field">
                <label className="request-field__label" htmlFor="request-create-need">
                  Specific need
                </label>
                <select
                  id="request-create-need"
                  className="request-field__control"
                  value={needId}
                  required
                  onChange={(event) => {
                    clearNeedDetails();
                    setNeedId(event.target.value);
                  }}
                >
                  <option value="">Choose need</option>
                  {selectedSubcategory.needs.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {selectedNeed?.allowsCustomText ? (
              <div className="request-field">
                <label className="request-field__label" htmlFor="request-create-custom-need">
                  Describe the need
                </label>
                <input
                  id="request-create-custom-need"
                  className="request-field__control"
                  maxLength={120}
                  required
                  value={customNeed}
                  onChange={(event) => setCustomNeed(event.target.value)}
                />
              </div>
            ) : null}
          </div>
        </section>

        {taxonomyComplete ? (
          <>
            <section className="request-form__section">
              <div className="request-form__section-header">
                <h2>Publishing</h2>
                <p>Choose who is asking and who can see the Request.</p>
              </div>
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
              </div>
            </section>

            <section className="request-form__section">
              <div className="request-form__section-header">
                <h2>Details</h2>
                <p>Keep the title clear and give enough context to help someone respond.</p>
              </div>
              <div className="request-field">
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
              </div>

              <div className="request-field">
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
              </div>
            </section>

            <section className="request-form__section">
              <div className="request-form__section-header">
                <h2>Location</h2>
                <p>Add only the location detail that is useful to the Request.</p>
              </div>
              <div className="request-form__grid">
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
                  <label className="request-field__label" htmlFor="request-create-full-address">
                    Full address
                  </label>
                  <input
                    id="request-create-full-address"
                    className="request-field__control"
                    aria-describedby="request-create-full-address-hint"
                    maxLength={240}
                    value={fullAddress}
                    onChange={(event) => setFullAddress(event.target.value)}
                  />
                  <span id="request-create-full-address-hint" className="request-field__hint">
                    Your precise address stays private and is not exposed in current Request read
                    projections.
                  </span>
                </div>

                <div className="request-field">
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
                </div>
              </div>
            </section>

            <section className="request-form__section">
              <div className="request-form__section-header">
                <h2>Photo</h2>
                <p>Optional. Upload a photo or use one external image URL.</p>
              </div>
              <div className="request-form__grid">
                <div className="request-field">
                  <label className="request-field__label" htmlFor="request-create-image-file">
                    Upload photo
                  </label>
                  <input
                    id="request-create-image-file"
                    className="request-field__control"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      setImageFile(file);
                      if (file) setImageUrl("");
                    }}
                  />
                </div>

                <div className="request-field">
                  <label className="request-field__label" htmlFor="request-create-image-url">
                    Image URL
                  </label>
                  <input
                    id="request-create-image-url"
                    className="request-field__control"
                    type="url"
                    value={imageUrl}
                    onChange={(event) => {
                      setImageUrl(event.target.value);
                      if (event.target.value.trim()) setImageFile(null);
                    }}
                  />
                </div>
              </div>
            </section>

            {productNeed ? (
              <section className="request-form__section">
                <div className="request-form__section-header">
                  <h2>Gear details</h2>
                  <p>These fields appear only for product needs.</p>
                </div>
                <div className="request-form__grid">
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
                </div>
              </section>
            ) : null}

            <section className="request-form__section">
              <div className="request-form__section-header">
                <h2>Timing</h2>
                <p>Optional dates help people understand urgency and availability.</p>
              </div>
              <div className="request-form__grid">
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
            </section>

            {error ? <p className="status request-error">{error}</p> : null}

            <div className="request-form__actions">
              <button className="help-action help-action--primary" type="submit" disabled={saving}>
                <PlusIcon />
                <span>{saving ? "Publishing…" : "Publish Request"}</span>
              </button>
              <a className="help-action help-action--quiet" href={returnHref}>
                Cancel
              </a>
            </div>
          </>
        ) : (
          <p className="request-create-progress-note">
            Complete the Request taxonomy above to continue.
          </p>
        )}
      </form>
    </section>
  );
}
