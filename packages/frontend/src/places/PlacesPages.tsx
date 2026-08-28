import { useEffect, useMemo, useState } from "react";
import type {
  PitchRentalCurrency,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import type { PublicEvent } from "../events/api";
import { useEventApi } from "../events/useEventApi";
import { pitchRateToMinor } from "../pitch/pricing";
import { PlaceForm } from "./PlaceForm";
import { createPlatformManagementApi } from "./platform-management-api";

export { PlaceDetailPage } from "./PlaceDetailPage";

const PITCH_RENTAL_CURRENCIES: readonly PitchRentalCurrency[] = ["TND", "EUR", "USD"];

function locationLabel(place: PublicPlaceSummary): string {
  return [place.houma, place.city].filter(Boolean).join(" · ") || place.address;
}

function nextEventTime(event: PublicEvent): string {
  const startsAt = new Date(event.startsAt);
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: event.timezone,
    }).format(startsAt);
  } catch {
    return startsAt.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
}

export function PlacesPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const eventApi = useEventApi();
  const [places, setPlaces] = useState<PublicPlaceSummary[]>([]);
  const [watchEvents, setWatchEvents] = useState<PublicEvent[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api.places
      .list()
      .then(setPlaces)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load Places"),
      );
    void eventApi
      .publicWatch()
      .then((page) => setWatchEvents(page.items))
      .catch(() => setWatchEvents([]));
  }, [api, eventApi]);

  const nextEventByPlace = useMemo(() => {
    const now = Date.now();
    const upcoming = watchEvents
      .filter(
        (event) =>
          event.placeId &&
          event.status !== "COMPLETED" &&
          Number.isFinite(new Date(event.startsAt).getTime()) &&
          new Date(event.startsAt).getTime() >= now,
      )
      .sort(
        (left, right) => new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
      );
    const byPlace = new Map<string, PublicEvent>();
    for (const event of upcoming) {
      if (event.placeId && !byPlace.has(event.placeId)) byPlace.set(event.placeId, event);
    }
    return byPlace;
  }, [watchEvents]);

  return (
    <section className="place-page">
      <header className="place-page__header">
        <div>
          <p className="eyebrow">PLACES</p>
          <h1>Places</h1>
          <p>Approved businesses and venues for Watch.</p>
        </div>
        <a className="place-primary-link" href="/places/new">
          Add a Place
        </a>
      </header>
      {error ? <p className="error">{error}</p> : null}
      <div className="place-directory">
        {places.map((place) => {
          const nextEvent = nextEventByPlace.get(place.id);
          return (
            <a
              className="place-card place-card--directory"
              href={`/places/${place.id}`}
              key={place.id}
            >
              <div className="place-card__copy">
                {place.category ? <span className="eyebrow">{place.category}</span> : null}
                <h2>{place.name}</h2>
                <p>{locationLabel(place)}</p>
                <small>{place.address}</small>
                {nextEvent ? (
                  <div>
                    <p className="eyebrow">NEXT · {nextEventTime(nextEvent)}</p>
                    <strong>{nextEvent.title}</strong>
                  </div>
                ) : null}
              </div>
              <div className="place-card__media">
                {place.imageUrl ? <img src={place.imageUrl} alt="" /> : <span>HOOMA</span>}
              </div>
            </a>
          );
        })}
        {!places.length && !error ? <p className="muted">No approved Places yet.</p> : null}
      </div>
    </section>
  );
}

export function AddPlacePage() {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const isPitchSuggestion = new URLSearchParams(window.location.search).get("kind") === "PITCH";
  const [pitchHourlyRate, setPitchHourlyRate] = useState("");
  const [pitchCurrency, setPitchCurrency] = useState<PitchRentalCurrency>("TND");
  const [error, setError] = useState("");
  const [submittedPlaceId, setSubmittedPlaceId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(input: Parameters<typeof api.places.suggest>[0]) {
    setPending(true);
    setError("");
    try {
      const created = await api.places.suggest({
        ...input,
        ...(isPitchSuggestion
          ? {
              suggestedCapabilities: ["PITCH"],
              pitch: {
                hourlyRateMinor: pitchRateToMinor(Number(pitchHourlyRate), pitchCurrency),
                currency: pitchCurrency,
              },
            }
          : {}),
      });
      setSubmittedPlaceId(created.id);
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit Place"));
    } finally {
      setPending(false);
    }
  }

  if (submittedPlaceId) {
    return (
      <section className="place-page">
        <div className="place-submitted panel">
          <p className="eyebrow">SUBMITTED</p>
          <h1>{isPitchSuggestion ? "Pitch suggested" : "Place submitted"}</h1>
          <p>
            {isPitchSuggestion
              ? "The App Admin will review this football pitch and its hourly rental price. Once approved, it can appear in Pitch and the real owner can claim it."
              : "The App Admin will review the Place. Once approved, it will appear in Places and can be used for Watch events."}
          </p>
          <div className="place-detail-actions">
            {!isPitchSuggestion ? (
              <a className="place-primary-link" href={`/places/${submittedPlaceId}/edit`}>
                Manage submitted Place
              </a>
            ) : null}
            <a href={isPitchSuggestion ? "/pitch" : "/watch"}>
              {isPitchSuggestion ? "Back to Pitch" : "Back to Watch"}
            </a>
          </div>
        </div>
      </section>
    );
  }

  const pitchPricingSection = isPitchSuggestion ? (
    <section className="hooma-form__section">
      <div className="hooma-form__section-heading">
        <span>04</span>
        <div>
          <h2>Rental price</h2>
          <p>The hourly price that will be reviewed before this Pitch is published.</p>
        </div>
      </div>
      <div className="hooma-form__grid">
        <label className="hooma-field">
          <span>Hourly rental price *</span>
          <input
            name="pitchHourlyRate"
            type="number"
            min="0"
            step="0.001"
            inputMode="decimal"
            value={pitchHourlyRate}
            onChange={(event) => setPitchHourlyRate(event.target.value)}
            required
          />
        </label>
        <label className="hooma-field">
          <span>Currency *</span>
          <select
            name="pitchCurrency"
            value={pitchCurrency}
            onChange={(event) => setPitchCurrency(event.target.value as PitchRentalCurrency)}
            required
          >
            {PITCH_RENTAL_CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  ) : null;

  return (
    <section className="place-page place-form-page">
      <header className="place-page__header place-form-page__header">
        <div>
          <p className="eyebrow">{isPitchSuggestion ? "SUGGEST A PITCH" : "ADD A PLACE"}</p>
          <h1>{isPitchSuggestion ? "Suggest a football pitch" : "List your Place"}</h1>
          <p>
            {isPitchSuggestion
              ? "Add the real venue details and hourly rental price. Suggesting a pitch does not make you its owner."
              : "Build the full venue profile once. Coordinates are optional."}
          </p>
        </div>
      </header>
      <PlaceForm
        submitLabel={isPitchSuggestion ? "Suggest Pitch" : "Submit Place"}
        pending={pending}
        showMenu={!isPitchSuggestion}
        extraSection={pitchPricingSection}
        onSubmit={submit}
      />
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
