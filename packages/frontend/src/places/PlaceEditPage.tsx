import { useEffect, useMemo, useState } from "react";
import type { ManagedPlaceSummary } from "@hooma/contracts/places";
import { useHoomaFrontend } from "../context";
import { PlaceForm } from "./PlaceForm";
import { createPlacesApi } from "./api";

export function PlaceEditPage({ placeId }: { readonly placeId: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlacesApi(transport), [transport]);
  const [place, setPlace] = useState<ManagedPlaceSummary | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .manage(placeId)
      .then(setPlace)
      .catch((reason) => setError(protectedError(reason, "Unable to open Place settings")));
  }, [api, placeId, protectedError]);

  async function save(input: Parameters<typeof api.update>[1]) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      const updated = await api.update(placeId, input);
      setPlace(updated);
      setNotice("Place saved.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to save Place"));
    } finally {
      setPending(false);
    }
  }

  async function deletePlace() {
    if (!place || deleting) return;
    if (
      !window.confirm(
        `Delete ${place.name}? It will disappear from active Places and Watch surfaces while historical records are preserved.`,
      )
    )
      return;
    setDeleting(true);
    setError("");
    try {
      await api.archive(placeId);
      window.location.href = "/places";
    } catch (reason) {
      setError(protectedError(reason, "Unable to delete Place"));
      setDeleting(false);
    }
  }

  if (!place)
    return error ? (
      <p className="error">{error}</p>
    ) : (
      <p className="status">Loading Place settings…</p>
    );

  return (
    <section className="place-page place-form-page">
      <a
        className="place-back-link"
        href={place.moderationStatus === "APPROVED" ? `/places/${place.id}` : "/watch"}
      >
        ← {place.moderationStatus === "APPROVED" ? place.name : "Watch"}
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
      <section className="entity-danger-zone place-danger-zone">
        <p className="eyebrow">PLACE MANAGEMENT</p>
        <h3>Delete Place</h3>
        <p>Remove this Place from active discovery while preserving historical records.</p>
        <button type="button" disabled={deleting || pending} onClick={() => void deletePlace()}>
          {deleting ? "Deleting…" : "Delete Place"}
        </button>
      </section>
    </section>
  );
}
