import { useEffect, useMemo, useState, type FormEvent } from "react";
import type {
  PlaceCapabilityKind,
  PublicPlaceCapability,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { PlaceCapabilityOnboarding } from "./PlaceCapabilityOnboarding";
import { createPlatformManagementApi } from "./platform-management-api";

function locationLabel(place: PublicPlaceSummary): string {
  return [place.houma, place.city].filter(Boolean).join(" · ") || place.address;
}

export function PlacesPage() {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [places, setPlaces] = useState<PublicPlaceSummary[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void api.places
      .list()
      .then(setPlaces)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load Places"),
      );
  }, [api]);

  async function suggest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError("");
    setMessage("");
    try {
      await api.places.suggest({
        name: String(data.get("name") ?? ""),
        address: String(data.get("address") ?? ""),
        city: String(data.get("city") ?? "") || null,
        houma: String(data.get("houma") ?? "") || null,
      });
      event.currentTarget.reset();
      setMessage("Place submitted for App review.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit Place"));
    }
  }

  return (
    <section className="place-page">
      <header className="section-heading">
        <div>
          <p className="eyebrow">PLACES</p>
          <h1>HOOMA Places</h1>
          <p className="muted">
            Approved physical venues. Watch and Pitch capabilities attach to these canonical Places.
          </p>
        </div>
      </header>
      <div className="place-directory">
        {places.map((place) => (
          <article className="panel place-card" key={place.id}>
            <h2>{place.name}</h2>
            <p>{locationLabel(place)}</p>
            <p className="muted">{place.address}</p>
          </article>
        ))}
        {!places.length && !error ? <p className="muted">No approved Places yet.</p> : null}
      </div>
      <form className="panel place-business-form" onSubmit={(event) => void suggest(event)}>
        <p className="eyebrow">SUGGEST A PLACE</p>
        <h2>Missing venue?</h2>
        <input name="name" placeholder="Place name" required minLength={2} />
        <input name="address" placeholder="Address" required minLength={3} />
        <input name="city" placeholder="City" />
        <input name="houma" placeholder="Houma" />
        <button type="submit">Submit for review</button>
      </form>
      {message ? <p className="status">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

function CapabilityPage({ kind }: { readonly kind: PlaceCapabilityKind }) {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [places, setPlaces] = useState<PublicPlaceSummary[]>([]);
  const [items, setItems] = useState<PublicPlaceCapability[]>([]);
  const [error, setError] = useState("");
  const title = kind === "WATCH" ? "Watch" : "Pitch";

  useEffect(() => {
    void Promise.all([api.places.list(), api.capability.list(kind)])
      .then(([placeRows, capabilityRows]) => {
        setPlaces(placeRows);
        setItems(capabilityRows);
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : `Unable to load ${title}`),
      );
  }, [api, kind, title]);

  return (
    <section className="place-page">
      <header className="section-heading">
        <div>
          <p className="eyebrow">{kind}</p>
          <h1>{title}</h1>
          <p className="muted">
            {kind === "WATCH"
              ? "Approved football viewing venues."
              : "Approved football pitches and bookable playing venues."}
          </p>
        </div>
      </header>

      <div className="place-directory">
        {items.map((item) => (
          <article className="panel place-card" key={item.id}>
            <h2>{item.place.name}</h2>
            <p>{locationLabel(item.place)}</p>
            <p>{item.summary}</p>
            <p className="muted">{item.place.address}</p>
          </article>
        ))}
        {!items.length && !error ? (
          <p className="muted">No approved {title} businesses yet.</p>
        ) : null}
      </div>

      <PlaceCapabilityOnboarding kind={kind} places={places} />
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}

export function PitchPage() {
  return <CapabilityPage kind="PITCH" />;
}
