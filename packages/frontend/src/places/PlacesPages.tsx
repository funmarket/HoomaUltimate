import { useEffect, useMemo, useState } from "react";
import type {
  PublicPlaceCapability,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { PlaceCapabilityOnboarding } from "./PlaceCapabilityOnboarding";
import { PlaceForm } from "./PlaceForm";
import { createPlatformManagementApi } from "./platform-management-api";

export { PlaceDetailPage } from "./PlaceDetailPage";

function locationLabel(place: PublicPlaceSummary): string {
  return [place.houma, place.city].filter(Boolean).join(" · ") || place.address;
}

export function PlacesPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [places, setPlaces] = useState<PublicPlaceSummary[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void api.places
      .list()
      .then(setPlaces)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load Places"),
      );
  }, [api]);

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
        {places.map((place) => (
          <a className="place-card place-card--directory" href={`/places/${place.id}`} key={place.id}>
            <div className="place-card__copy">
              {place.category ? <span className="eyebrow">{place.category}</span> : null}
              <h2>{place.name}</h2>
              <p>{locationLabel(place)}</p>
              <small>{place.address}</small>
            </div>
            <div className="place-card__media">
              {place.imageUrl ? <img src={place.imageUrl} alt="" /> : <span>HOOMA</span>}
            </div>
          </a>
        ))}
        {!places.length && !error ? <p className="muted">No approved Places yet.</p> : null}
      </div>
    </section>
  );
}

export function AddPlacePage() {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [error, setError] = useState("");
  const [submittedPlaceId, setSubmittedPlaceId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(input: Parameters<typeof api.places.suggest>[0]) {
    setPending(true);
    setError("");
    try {
      const created = await api.places.suggest(input);
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
          <h1>Place submitted</h1>
          <p>
            The App Admin will review the Place. Once approved, it will appear in Places and can be
            used for Watch events.
          </p>
          <div className="place-detail-actions">
            <a className="place-primary-link" href={`/places/${submittedPlaceId}/edit`}>
              Manage submitted Place
            </a>
            <a href="/watch">Back to Watch</a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="place-page place-form-page">
      <header className="place-page__header place-form-page__header">
        <div>
          <p className="eyebrow">ADD A PLACE</p>
          <h1>List your Place</h1>
          <p>Build the full venue profile once. Coordinates are optional.</p>
        </div>
      </header>
      <PlaceForm submitLabel="Submit Place" pending={pending} onSubmit={submit} />
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

export function PitchPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [places, setPlaces] = useState<PublicPlaceSummary[]>([]);
  const [items, setItems] = useState<PublicPlaceCapability[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([api.places.list(), api.capability.list("PITCH")])
      .then(([placeRows, capabilityRows]) => {
        setPlaces(placeRows);
        setItems(capabilityRows);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load Pitch"),
      );
  }, [api]);

  return (
    <section className="place-page">
      <header className="section-heading">
        <div>
          <p className="eyebrow">PITCH</p>
          <h1>Pitch</h1>
          <p className="muted">Approved football pitches and bookable playing venues.</p>
        </div>
      </header>
      <div className="place-directory">
        {items.map((item) => (
          <article className="panel place-card" key={item.id}>
            <h2>{item.place.name}</h2>
            <p>{locationLabel(item.place)}</p>
            <p>{item.summary}</p>
          </article>
        ))}
      </div>
      <PlaceCapabilityOnboarding places={places} />
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
