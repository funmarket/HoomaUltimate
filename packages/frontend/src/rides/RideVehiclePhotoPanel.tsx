import { useMemo, useState, type FormEvent } from "react";
import { useHoomaFrontend } from "../context";
import { createRideApi } from "./api";

export function RideVehiclePhotoPanel({
  offerId,
  hasVehiclePhoto,
}: {
  readonly offerId: string;
  readonly hasVehiclePhoto: boolean;
}) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createRideApi(transport), [transport]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await api.replaceOfferVehiclePhoto(offerId, file);
      setFile(null);
      setMessage("Vehicle photo saved. Refresh the offer to see the latest image.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to save vehicle photo"));
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await api.deleteOfferVehiclePhoto(offerId);
      setMessage("Vehicle photo removed.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to remove vehicle photo"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ride-photo-panel">
      <form onSubmit={upload}>
        <label className="ride-field">
          <span>{hasVehiclePhoto ? "Replace vehicle photo" : "Vehicle photo"}</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <div className="ride-actions">
          <button
            className="ride-button ride-button--primary"
            type="submit"
            disabled={!file || busy}
          >
            {busy ? "Saving..." : "Upload photo"}
          </button>
          {hasVehiclePhoto ? (
            <button
              className="ride-button"
              type="button"
              disabled={busy}
              onClick={() => void removePhoto()}
            >
              Remove photo
            </button>
          ) : null}
        </div>
      </form>
      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
