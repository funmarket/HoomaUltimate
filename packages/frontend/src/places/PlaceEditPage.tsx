import { useEffect, useMemo, useState } from "react";
import type { ManagedPlaceSummary } from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { PlaceForm } from "./PlaceForm";
import { createPlatformManagementApi } from "./platform-management-api";

export function PlaceEditPage({ placeId }: { readonly placeId: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [place, setPlace] = useState<ManagedPlaceSummary | null>(null);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api.places
      .manage(placeId)
      .then(setPlace)
      .catch((reason) => setError(protectedError(reason, "Unable to open Place settings")));
  }, [api, placeId, protectedError]);

  async function save(input: Parameters<typeof api.places.update>[1]) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.places.update(placeId, input);
      setPlace(updated);
      setNotice("Place saved.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to save Place"));
    } finally {
      setPending(false);
    }
  }

  if (!place)
    return error ? <p className="error">{error}</p> : <p className="status">Loading Place settings…</p>;

  return (
    <section className="place-page place-form-page">
      <a className="place-back-link" href={`/places/${place.id}`}>
        ← {place.name}
      </a>
      <header className="place-page__header place-form-page__header">
        <div>
          <p className="eyebrow">PLACE SETTINGS</p>
          <h1>Edit Place</h1>
          <p>Update the same canonical Place shown across Watch and Places.</p>
        </div>
      </header>
      <PlaceForm initialPlace={place} submitLabel="Save Place" pending={pending} onSubmit={save} />
      {notice ? <p className="success">{notice}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
