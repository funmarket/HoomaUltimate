import { useEffect, useMemo, useState } from "react";
import { ATHLETES_SPORTS, type AthletesSport } from "@hooma/contracts/athletes";
import {
  GEAR_UP_PRODUCT_CATEGORIES,
  GEAR_UP_PRODUCT_CATEGORY_LABELS,
  gearUpShopSuggestionSchema,
  type GearUpOfferType,
  type GearUpPaymentMethod,
  type GearUpProductCategory,
} from "@hooma/contracts/gear-up";
import type {
  PlaceSubmissionOrigin,
  PlaceSuggestionResult,
} from "@hooma/contracts/places";
import { AthletesHubTabs } from "../athletes/AthletesHubTabs";
import { sportLabel } from "../athletes/sports";
import { useHoomaFrontend } from "../context";
import { PlaceForm } from "../places/PlaceForm";
import { createGearUpApi } from "./api";

type PlaceFormInput = Parameters<Parameters<typeof PlaceForm>[0]["onSubmit"]>[0];
type AccountState = "loading" | "signed-in" | "signed-out";

function toggleValue<T extends string>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function categoryLabel(category: GearUpProductCategory): string {
  return GEAR_UP_PRODUCT_CATEGORY_LABELS[category];
}

export function AddGearUpShopPage() {
  const { api, transport, protectedError, authenticationHref } = useHoomaFrontend();
  const gearUpApi = useMemo(() => createGearUpApi(transport), [transport]);
  const [accountState, setAccountState] = useState<AccountState>("loading");
  const [accountError, setAccountError] = useState("");
  const [submissionOrigin, setSubmissionOrigin] = useState<PlaceSubmissionOrigin>("OWNER");
  const [offerTypes, setOfferTypes] = useState<GearUpOfferType[]>([]);
  const [sports, setSports] = useState<AthletesSport[]>([]);
  const [categories, setCategories] = useState<GearUpProductCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<GearUpPaymentMethod[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [submissionResult, setSubmissionResult] = useState<PlaceSuggestionResult | null>(null);

  useEffect(() => {
    let active = true;
    void api.identity
      .meOptional()
      .then((current) => {
        if (active) setAccountState(current ? "signed-in" : "signed-out");
      })
      .catch((reason) => {
        if (!active) return;
        setAccountError(protectedError(reason, "Unable to verify your HOOMA account"));
        setAccountState("signed-out");
      });
    return () => {
      active = false;
    };
  }, [api, protectedError]);

  async function submit(input: PlaceFormInput) {
    const parsed = gearUpShopSuggestionSchema.safeParse({
      place: {
        name: input.name,
        address: input.address,
        city: input.city,
        houma: input.houma,
        latitude: input.latitude,
        longitude: input.longitude,
        phone: input.phone,
        websiteUrl: input.websiteUrl,
        imageUrl: input.imageUrl,
        imageUrls: input.imageUrls,
        description: input.description,
        category: input.category,
        email: input.email,
        menuItems: input.menuItems,
        submissionOrigin,
      },
      shop: {
        offerTypes,
        sports,
        categories,
        paymentMethods,
      },
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the Store details and try again.");
      return;
    }

    setPending(true);
    setError("");
    try {
      setSubmissionResult(await gearUpApi.suggestShop(parsed.data));
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit Gear Up Store"));
    } finally {
      setPending(false);
    }
  }

  if (accountState === "loading") {
    return <p className="status">Loading Gear Up Store setup…</p>;
  }

  if (accountState === "signed-out") {
    const href = authenticationHref("/athletes/gear-up/add-store");
    return (
      <section className="gear-up-page gear-up-add-store">
        <AthletesHubTabs active="gear-up" />
        <section className="gear-up-empty-state">
          <p className="gear-up-hero__eyebrow">ADD STORE</p>
          <h1>Sign in to add a Gear Up Store.</h1>
          <p>An HOOMA account is required before a Store can be submitted for review.</p>
          {href ? (
            <a className="gear-up-add-store-link" href={href}>
              Sign in to continue
            </a>
          ) : null}
          {accountError ? <p className="error">{accountError}</p> : null}
        </section>
      </section>
    );
  }

  if (submissionResult) {
    const placeId = submissionResult.place.id;
    const existing = submissionResult.outcome === "EXISTING";
    const approved = submissionResult.status === "APPROVED";
    const reviewPending = submissionResult.status === "PENDING";

    return (
      <section className="gear-up-page gear-up-add-store">
        <AthletesHubTabs active="gear-up" />
        <section className="gear-up-empty-state">
          <p className="gear-up-hero__eyebrow">{existing ? "EXISTING PLACE" : "SUBMITTED"}</p>
          <h1>{existing ? "No duplicate created" : "Store submitted"}</h1>
          <p>
            {existing
              ? "HOOMA kept the existing canonical Place and attached the Gear Up submission to it."
              : "Your Store is now in the Gear Up review flow."}
          </p>
          <p>
            App Admin review remains required for Gear Up publication. If you submitted By Owner,
            verified ownership remains separate and is not granted by this Store submission.
          </p>
          {reviewPending ? <p className="muted">The canonical Place is still pending review.</p> : null}
          {approved ? (
            <p className="muted">
              The canonical Place is approved; Gear Up Store moderation is still handled separately.
            </p>
          ) : null}
          <a className="gear-up-add-store-link" href="/athletes/gear-up">
            Back to Gear Up
          </a>
          <span className="gear-up-visually-hidden">Store Place ID: {placeId}</span>
        </section>
      </section>
    );
  }

  const shopDetails = (
    <section className="hooma-form__section gear-up-add-store__shop-fields">
      <div className="hooma-form__section-heading">
        <span>04</span>
        <div>
          <h2>Gear Up Store details</h2>
          <p>Choose what this Store offers and how customers can pay.</p>
        </div>
      </div>

      <fieldset className="gear-up-filter-group">
        <legend>What does this Store offer?</legend>
        <div className="gear-up-filter-row">
          {(["SPORTSWEAR", "GEAR"] as const).map((offer) => (
            <button
              key={offer}
              type="button"
              className={`gear-up-chip${offerTypes.includes(offer) ? " is-active" : ""}`}
              aria-pressed={offerTypes.includes(offer)}
              onClick={() => setOfferTypes((values) => toggleValue(values, offer))}
            >
              {offer === "SPORTSWEAR" ? "Sportswear" : "Gear"}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="gear-up-filter-group">
        <legend>Sports</legend>
        <div className="gear-up-filter-rail">
          {ATHLETES_SPORTS.map((sport) => (
            <button
              key={sport}
              type="button"
              className={`gear-up-chip${sports.includes(sport) ? " is-active" : ""}`}
              aria-pressed={sports.includes(sport)}
              onClick={() => setSports((values) => toggleValue(values, sport))}
            >
              {sportLabel(sport)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="gear-up-filter-group">
        <legend>Product categories</legend>
        <div className="gear-up-add-store__category-grid">
          {GEAR_UP_PRODUCT_CATEGORIES.map((category) => (
            <button
              key={category}
              type="button"
              className={`gear-up-chip${categories.includes(category) ? " is-active" : ""}`}
              aria-pressed={categories.includes(category)}
              onClick={() => setCategories((values) => toggleValue(values, category))}
            >
              {categoryLabel(category)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="gear-up-filter-group">
        <legend>Payment you wish to accept</legend>
        <div className="gear-up-filter-row">
          <button
            type="button"
            className={`gear-up-chip${paymentMethods.includes("CASH") ? " is-active" : ""}`}
            aria-pressed={paymentMethods.includes("CASH")}
            onClick={() => setPaymentMethods((values) => toggleValue(values, "CASH"))}
          >
            Cash
          </button>
          <button type="button" className="gear-up-chip" disabled aria-disabled="true">
            Crypto
          </button>
          <button
            type="button"
            className={`gear-up-chip${paymentMethods.includes("CARD_BY_PHONE") ? " is-active" : ""}`}
            aria-pressed={paymentMethods.includes("CARD_BY_PHONE")}
            onClick={() => setPaymentMethods((values) => toggleValue(values, "CARD_BY_PHONE"))}
          >
            Card by phone
          </button>
        </div>
        <p className="gear-up-add-store__note">
          Crypto stays unavailable until an HOOMA saved wallet can be selected. No raw wallet address
          is collected here.
        </p>
      </fieldset>
    </section>
  );

  return (
    <section className="gear-up-page gear-up-add-store">
      <AthletesHubTabs active="gear-up" />

      <header className="gear-up-hero">
        <p className="gear-up-hero__eyebrow">ADD STORE</p>
        <h1 className="gear-up-page__title">Add a Store to Gear Up.</h1>
        <p className="gear-up-hero__description">
          Keep one canonical HOOMA Place while adding the Store details Gear Up needs.
        </p>
      </header>

      <section className="gear-up-add-store__source">
        <p className="gear-up-hero__eyebrow">WHO IS ADDING THIS STORE?</p>
        <div className="place-source-tabs" role="tablist" aria-label="Gear Up Store submission source">
          <button
            type="button"
            role="tab"
            aria-selected={submissionOrigin === "OWNER"}
            className={submissionOrigin === "OWNER" ? "place-source-tab is-active" : "place-source-tab"}
            onClick={() => setSubmissionOrigin("OWNER")}
          >
            By Owner
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={submissionOrigin === "FANHUB"}
            className={submissionOrigin === "FANHUB" ? "place-source-tab is-active" : "place-source-tab"}
            onClick={() => setSubmissionOrigin("FANHUB")}
          >
            FanHub
          </button>
        </div>
        <p className="gear-up-add-store__note">
          {submissionOrigin === "OWNER"
            ? "Choose By Owner only when you own or manage this Store. Verification remains separate from submission."
            : "FanHub lets a registered HOOMA member suggest a Store for the community without gaining ownership or management authority."}
        </p>
      </section>

      <PlaceForm
        submitLabel="Submit Store"
        pending={pending}
        showMenu={false}
        extraSection={shopDetails}
        onSubmit={submit}
      />
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
