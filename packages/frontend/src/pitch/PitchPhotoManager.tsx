import { useMemo, useState, type FormEvent } from "react";
import type { PublicPlaceSummary } from "@hooma/contracts/places";
import { useHoomaFrontend } from "../context";
import { createPlacesApi } from "../places/api";

export function PitchPhotoManager({
  place,
  maxImages,
  onChanged,
}: {
  readonly place: PublicPlaceSummary;
  readonly maxImages: number;
  readonly onChanged: () => Promise<void>;
}) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlacesApi(transport), [transport]);
  const [externalUrl, setExternalUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const atLimit = place.images.length >= maxImages;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await onChanged();
    } catch (reason) {
      setError(protectedError(reason, "Unable to update Pitch photos"));
    } finally {
      setBusy(false);
    }
  }

  async function addExternal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!externalUrl.trim() || atLimit) return;
    await run(async () => {
      await api.addExternalImage(place.id, { url: externalUrl.trim() });
      setExternalUrl("");
    });
  }

  async function upload(file: File | null) {
    if (!file || atLimit) return;
    await run(() => api.uploadImage(place.id, file));
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= place.images.length) return;
    const ids = place.images.map((image) => image.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await run(() => api.reorderImages(place.id, { imageIds: ids }));
  }

  return (
    <section className="panel pitch-photo-manager">
      <p className="eyebrow">PITCH PHOTOS</p>
      <h2>Gallery</h2>
      <p className="muted">
        {maxImages === 6
          ? "App Admin may extend this canonical Place gallery to 6 photos."
          : "Verified owners can keep up to 3 canonical Pitch photos."}
      </p>
      <div className="pitch-photo-manager__list">
        {place.images.map((image, index) => (
          <article key={image.id}>
            <img src={image.imageUrl} alt={`${place.name} photo ${index + 1}`} />
            <div>
              <button type="button" disabled={busy || index === 0} onClick={() => void move(index, -1)}>
                Move up
              </button>
              <button
                type="button"
                disabled={busy || index === place.images.length - 1}
                onClick={() => void move(index, 1)}
              >
                Move down
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => api.deleteImage(place.id, image.id))}
              >
                Remove
              </button>
            </div>
          </article>
        ))}
      </div>
      <form onSubmit={(event) => void addExternal(event)}>
        <label className="place-business-field">
          <span>Image URL</span>
          <input
            type="url"
            value={externalUrl}
            disabled={busy || atLimit}
            placeholder="https://…"
            onChange={(event) => setExternalUrl(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy || atLimit || !externalUrl.trim()}>
          Add image URL
        </button>
      </form>
      <label className="place-business-field">
        <span>Upload photo</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || atLimit}
          onChange={(event) => void upload(event.currentTarget.files?.[0] ?? null)}
        />
      </label>
      {atLimit ? <p className="muted">Photo limit reached.</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
