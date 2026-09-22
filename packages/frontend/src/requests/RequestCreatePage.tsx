import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { MeResponse } from "@hooma/contracts";
import type { HelpTaxonomyResponse } from "@hooma/contracts/help-taxonomy";
import { helpRequestCreateSchema, type HelpRequestCreateInput } from "@hooma/contracts/requests";
import { useHoomaFrontend } from "../context";
import { PlusIcon } from "../help/HelpIcons";
import { createRequestsApi } from "./api";
import { REQUEST_SURFACES, resolveRequestSurface } from "./surface";

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
  const surface = useMemo(resolveRequestSurface, []);
  const { returnHref, returnLabel } = REQUEST_SURFACES[surface];
  const createHref = surface === "REQUESTS" ? "/requests/new" : `/requests/new?surface=${surface}`;
  const [me, setMe] = useState<MeResponse | null>(null);
  const [taxonomy, setTaxonomy] = useState<HelpTaxonomyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState("");
  const [uploadNote, setUploadNote] = useState("");
  const [publisher, setPublisher] = useState("personal");
  const [audience, setAudience] = useState("public");
  const [requestType, setRequestType] = useState<"SPORT" | "COMMUNITY">("SPORT");
  const [sport, setSport] = useState("");
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
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [neededByAt, setNeededByAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([api.identity.meOptional(), requestsApi.taxonomy(surface)])
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
  }, [api, protectedError, requestsApi, surface]);

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

  /**
   * Progressive disclosure: the root choice decides which taxonomy branch is
   * shown and whether a sport is part of the Request at all. Community needs
   * never ask a person to pick a sport first.
   */
  const communityRequest = requestType === "COMMUNITY";
  const selectedSport = communityRequest
    ? undefined
    : taxonomy?.sports.find((entry) => entry.sport === sport);
  const subcategoryOptions = communityRequest
    ? (taxonomy?.community ?? [])
    : (selectedSport?.subcategories ?? []);
  const selectedSubcategory = subcategoryOptions.find((entry) => entry.id === subcategoryId);
  const selectedNeed = selectedSubcategory?.needs.find((entry) => entry.id === needId);
  const productNeed = selectedNeed?.kind === "PRODUCT";

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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    setError("");
    const parsed = helpRequestCreateSchema.safeParse({
      publisher: publisherInput(),
      audience: audienceInput(),
      requestType,
      sport: communityRequest ? undefined : sport || undefined,
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
      imageUrl: optionalText(imageUrl),
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
      if (imageFile && imageFile.size > 0) {
        try {
          await requestsApi.uploadImage(created.id, imageFile, imageFile.type);
        } catch (reason) {
          // The Request is already published: report the photo failure without
          // pretending the whole publish failed, or that the photo landed.
          setUploadNote(
            protectedError(
              reason,
              "Your Request was published, but the photo did not upload. You can add it from the Request page.",
            ),
          );
        }
      }
      setCreatedId(created.id);
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
            <a className="help-action" href={href}>
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
          {uploadNote ? <p className="status request-error">{uploadNote}</p> : null}
          <div className="request-action-row">
            <a className="help-action" href={`/requests/${encodeURIComponent(createdId)}`}>
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
      <header className="help-hero panel">
        <div className="help-hero__copy">
          <span className="eyebrow">HOOMA HELP</span>
          <h1>Create a Request</h1>
          <p>
            Choose Sport or Community, select the exact need, then tell people where help is needed.
          </p>
        </div>
      </header>

      <form className="request-form panel" onSubmit={submit}>
        <label className="request-field__label" htmlFor="request-create-title">
          Title
        </label>
        <input
          id="request-create-title"
          className="request-field__control"
          maxLength={120}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

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
            <label className="request-field__label" htmlFor="request-create-type">
              Request type
            </label>
            <select
              id="request-create-type"
              className="request-field__control"
              value={requestType}
              onChange={(event) => {
                setRequestType(event.target.value === "COMMUNITY" ? "COMMUNITY" : "SPORT");
                setSport("");
                setSubcategoryId("");
                setNeedId("");
                setCustomNeed("");
              }}
            >
              <option value="SPORT">Sport</option>
              <option value="COMMUNITY">Community</option>
            </select>
          </div>

          {communityRequest ? null : (
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
                  setNeedId("");
                  setCustomNeed("");
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
          )}

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-subcategory">
              {communityRequest ? "Community subcategory" : "Subcategory"}
            </label>
            <select
              id="request-create-subcategory"
              className="request-field__control"
              value={subcategoryId}
              required
              disabled={communityRequest ? false : !selectedSport}
              onChange={(event) => {
                setSubcategoryId(event.target.value);
                setNeedId("");
                setCustomNeed("");
              }}
            >
              <option value="">Choose subcategory</option>
              {subcategoryOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>

          <div className="request-field">
            <label className="request-field__label" htmlFor="request-create-need">
              Specific item / need
            </label>
            <select
              id="request-create-need"
              className="request-field__control"
              value={needId}
              required
              disabled={!selectedSubcategory}
              onChange={(event) => {
                setNeedId(event.target.value);
                setCustomNeed("");
              }}
            >
              <option value="">Choose need</option>
              {(selectedSubcategory?.needs ?? []).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>

          {selectedNeed?.allowsCustomText ? (
            <div className="request-field">
              <label className="request-field__label" htmlFor="request-create-custom-need">
                Describe the need
              </label>
              <input
                id="request-create-custom-need"
                className="request-field__control"
                maxLength={120}
                value={customNeed}
                onChange={(event) => setCustomNeed(event.target.value)}
              />
            </div>
          ) : null}

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
              Full address (optional)
            </label>
            <input
              id="request-create-full-address"
              className="request-field__control"
              maxLength={240}
              value={fullAddress}
              onChange={(event) => setFullAddress(event.target.value)}
            />
          </div>
        </div>

        <label className="request-field__label" htmlFor="request-create-image-url">
          Photo link (optional)
        </label>
        <input
          id="request-create-image-url"
          className="request-field__control"
          inputMode="url"
          maxLength={2000}
          placeholder="https://…"
          value={imageUrl}
          onChange={(event) => {
            setImageUrl(event.target.value);
            if (event.target.value.trim()) setImageFile(null);
          }}
        />

        <label className="request-field__label" htmlFor="request-create-image-file">
          …or upload a photo
        </label>
        <input
          id="request-create-image-file"
          className="request-field__control"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            setImageFile(file);
            if (file) setImageUrl("");
          }}
        />
        <p className="muted">
          One photo per Request: a link or an uploaded JPEG/PNG/WebP up to 5 MB.
        </p>

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

        {productNeed ? (
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
        ) : null}

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
          <a className="help-action help-action--quiet" href={returnHref}>
            Cancel
          </a>
        </div>
      </form>
    </section>
  );
}
