import { useEffect, useMemo, useState } from "react";
import type {
  PublicPlaceCapability,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import type { PublicEvent } from "../events/api";
import { useEventApi } from "../events/useEventApi";
import { PlaceCapabilityOnboarding } from "./PlaceCapabilityOnboarding";
import { PlaceForm } from "./PlaceForm";
import { createPlatformManagementApi } from "./platform-management-api";

export { PlaceDetailPage } from "./PlaceDetailPage";

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
        (left, right) =>
          new Date(left.startsAt).getTime() - new Date(right.startsAt).getTime(),
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
