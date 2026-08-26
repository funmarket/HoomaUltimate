import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  PublicPlaceCapability,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createEventApi, type PublicEvent } from "../events/api";
import { PlaceCapabilityOnboarding } from "./PlaceCapabilityOnboarding";
import { createPlatformManagementApi } from "./platform-management-api";

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
          <a className="place-card" href={`/places/${place.id}`} key={place.id}>
            <div className="place-card__media">
              {place.imageUrl ? <img src={place.imageUrl} alt="" /> : <span>HOOMA</span>}
            </div>
            <div className="place-card__copy">
              {place.category ? <span className="eyebrow">{place.category}</span> : null}
              <h2>{place.name}</h2>
              <p>{locationLabel(place)}</p>
              <small>{place.address}</small>
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
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const optionalNumber = (name: string) => {
      const value = String(data.get(name) ?? "").trim();
      return value ? Number(value) : null;
    };
    const optionalText = (name: string) => String(data.get(name) ?? "").trim() || null;
    setError("");
    try {
      await api.places.suggest({
        name: String(data.get("name") ?? ""),
        category: optionalText("category"),
        description: optionalText("description"),
        imageUrl: optionalText("imageUrl"),
        address: String(data.get("address") ?? ""),
        city: optionalText("city"),
        houma: optionalText("houma"),
        latitude: optionalNumber("latitude"),
        longitude: optionalNumber("longitude"),
        phone: optionalText("phone"),
        email: optionalText("email"),
        websiteUrl: optionalText("websiteUrl"),
      });
      event.currentTarget.reset();
      setSubmitted(true);
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit Place"));
    }
  }

  if (submitted) {
    return (
      <section className="place-page">
        <div className="place-submitted panel">
          <p className="eyebrow">SUBMITTED</p>
          <h1>Place submitted</h1>
          <p>
            The App Admin will review the Place. Once approved, it will appear in Places and can be
            used for Watch events.
          </p>
          <a className="place-primary-link" href="/watch">
            Back to Watch
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="place-page">
      <header className="place-page__header">
        <div>
          <p className="eyebrow">ADD A PLACE</p>
          <h1>List your Place</h1>
          <p>
            Submit the business information once. App Admin approval makes it available to Watch.
          </p>
        </div>
      </header>
      <form className="panel place-add-form" onSubmit={(event) => void submit(event)}>
        <div className="place-form-grid">
          <label>
            Place name
            <input name="name" required minLength={2} />
          </label>
          <label>
            Category
            <input name="category" placeholder="Sports café, bar, restaurant…" />
          </label>
        </div>
        <label>
          Description
          <textarea name="description" rows={4} placeholder="Tell people about the Place" />
        </label>
        <label>
          Image URL
          <input name="imageUrl" type="url" placeholder="https://…" />
        </label>
        <label>
          Address
          <input name="address" required minLength={3} />
        </label>
        <div className="place-form-grid">
          <label>
            City
            <input name="city" />
          </label>
          <label>
            Houma
            <input name="houma" />
          </label>
        </div>
        <div className="place-form-grid">
          <label>
            Latitude
            <input name="latitude" type="number" min="-90" max="90" step="any" />
          </label>
          <label>
            Longitude
            <input name="longitude" type="number" min="-180" max="180" step="any" />
          </label>
        </div>
        <div className="place-form-grid">
          <label>
            Phone
            <input name="phone" inputMode="tel" />
          </label>
          <label>
            Email
            <input name="email" type="email" />
          </label>
        </div>
        <label>
          Website
          <input name="websiteUrl" type="url" placeholder="https://…" />
        </label>
        <button type="submit">Submit Place</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </section>
  );
}

export function PlaceDetailPage({ placeId }: { readonly placeId: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const management = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const eventsApi = useMemo(() => createEventApi(transport), [transport]);
  const [place, setPlace] = useState<PublicPlaceSummary | null>(null);
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [claimOpen, setClaimOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([management.places.get(placeId), eventsApi.publicWatch()])
      .then(([row, eventPage]) => {
        setPlace(row);
        setEvents(eventPage.items.filter((event) => event.placeId === placeId));
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load Place"),
      );
  }, [eventsApi, management, placeId]);

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setMessage("");
    try {
      await management.places.claimOwnership(placeId, {
        evidence: String(data.get("evidence") ?? ""),
      });
      setMessage("Ownership claim submitted to the App Admin.");
      setClaimOpen(false);
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit ownership claim"));
    }
  }

  if (!place)
    return error ? <p className="error">{error}</p> : <p className="status">Loading Place…</p>;

  return (
    <section className="place-detail-page">
      <a className="place-back-link" href="/places">
        ← Places
      </a>
      <div className="place-detail-hero">
        <div className="place-detail-hero__media">
          {place.imageUrl ? <img src={place.imageUrl} alt={place.name} /> : <span>HOOMA</span>}
        </div>
        <div className="place-detail-hero__copy">
          {place.category ? <p className="eyebrow">{place.category}</p> : null}
          <h1>{place.name}</h1>
          <p>{place.description || "Watch together at this HOOMA Place."}</p>
          <div className="place-detail-actions">
            {place.phone ? <a href={`tel:${place.phone}`}>Call</a> : null}
            {place.websiteUrl ? (
              <a href={place.websiteUrl} target="_blank" rel="noreferrer">
                Website
              </a>
            ) : null}
          </div>
        </div>
      </div>
      <div className="place-info-grid">
        <article>
          <span>Address</span>
          <strong>{place.address}</strong>
        </article>
        <article>
          <span>Houma</span>
          <strong>{place.houma || "—"}</strong>
        </article>
        <article>
          <span>City</span>
          <strong>{place.city || "—"}</strong>
        </article>
        <article>
          <span>Contact</span>
          <strong>{place.phone || place.email || "—"}</strong>
        </article>
      </div>
      <section className="place-events-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">WATCH</p>
            <h2>Upcoming Watch events at this Place</h2>
          </div>
          <span>{events.length}</span>
        </div>
        <div className="place-event-list">
          {events.map((event) => (
            <a key={event.id} href={`/events/${event.id}`}>
              <strong>{event.title}</strong>
              <span>
                {new Date(event.startsAt).toLocaleString()} · {event._count.rsvps} going
              </span>
            </a>
          ))}
          {!events.length ? <p className="muted">No upcoming Watch events yet.</p> : null}
        </div>
      </section>
      <section className="place-claim-section">
        <button
          type="button"
          className="place-claim-toggle"
          onClick={() => setClaimOpen((value) => !value)}
        >
          Own/manage this place?
        </button>
        {claimOpen ? (
          <form className="panel place-claim-form" onSubmit={(event) => void claim(event)}>
            <label>
              Ownership or management evidence
              <textarea name="evidence" minLength={10} required />
            </label>
            <button type="submit">Submit ownership claim</button>
          </form>
        ) : null}
        {message ? <p className="status">{message}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>
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
