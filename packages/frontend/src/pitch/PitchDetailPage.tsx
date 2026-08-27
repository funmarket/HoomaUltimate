import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { PublicPlaceCapability } from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { HoomaApiError } from "../http";
import { createPlatformManagementApi } from "../places/platform-management-api";
import { formatPitchHourlyRate } from "./pricing";

export function PitchDetailPage({ placeId }: { readonly placeId: string }) {
  const { transport, protectedError } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [item, setItem] = useState<PublicPlaceCapability | null>(null);
  const [loading, setLoading] = useState(true);
  const [canManage, setCanManage] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimPending, setClaimPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    void api.capability
      .get("PITCH", placeId)
      .then(setItem)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load Pitch"),
      )
      .finally(() => setLoading(false));

    void api.places
      .manage(placeId)
      .then(() => setCanManage(true))
      .catch((reason) => {
        if (reason instanceof HoomaApiError && [401, 403].includes(reason.status)) return;
      });
  }, [api, placeId]);

  async function claim(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setClaimPending(true);
    setError("");
    setMessage("");
    try {
      await api.places.claimOwnership(placeId, {
        evidence: String(data.get("evidence") ?? ""),
      });
      event.currentTarget.reset();
      setClaimOpen(false);
      setMessage("Ownership claim submitted for App review.");
    } catch (reason) {
      setError(protectedError(reason, "Unable to submit ownership claim"));
    } finally {
      setClaimPending(false);
    }
  }

  if (loading) return <p className="status">Loading pitch…</p>;
  if (error && !item) return <p className="error">{error}</p>;
  if (!item) {
    return (
      <section className="pitch-detail-page">
        <div className="panel pitch-empty">
          <h1>Pitch unavailable</h1>
          <p className="muted">This rental is not currently approved or publicly available.</p>
          <a className="pitch-back-link" href="/pitch">
            Back to Pitch
          </a>
        </div>
      </section>
    );
  }

  const place = item.place;
  const images = place.images.length
    ? place.images
    : place.imageUrl
      ? [{ id: "cover", imageUrl: place.imageUrl, sortOrder: 0 }]
      : [];
  const location = [place.city, place.houma].filter(Boolean).join(" · ") || place.address;
  const rate = formatPitchHourlyRate(item.hourlyRateMinor, item.currency);

  return (
    <section className="pitch-detail-page">
      <a className="pitch-back-link" href="/pitch">
        ← Pitch
      </a>

      <article className="pitch-detail-card">
        <header className="pitch-detail-card__header">
          <div>
            <p className="pitch-rental-card__location">{location}</p>
            <h1>{place.name}</h1>
            <p>{item.summary}</p>
          </div>
          <div className="pitch-detail-card__price">
            <strong>{rate}</strong>
            {item.hourlyRateMinor !== null && item.currency ? (
              <span>{item.currency} / HOUR</span>
            ) : null}
          </div>
        </header>

        {images.length ? (
          <div className="pitch-detail-gallery">
            {images.map((image, index) => (
              <img
                key={image.id}
                src={image.imageUrl}
                alt={`${place.name} ${index + 1}`}
                loading={index ? "lazy" : "eager"}
              />
            ))}
          </div>
        ) : (
          <div className="pitch-detail-gallery pitch-detail-gallery--empty">HOOMA PITCH</div>
        )}

        <div className="pitch-detail-card__information">
          <div>
            <span className="eyebrow">ADDRESS</span>
            <strong>{place.address}</strong>
          </div>
          {place.phone ? (
            <div>
              <span className="eyebrow">PHONE</span>
              <a href={`tel:${place.phone}`}>{place.phone}</a>
            </div>
          ) : null}
          {place.websiteUrl ? (
            <div>
              <span className="eyebrow">WEBSITE</span>
              <a href={place.websiteUrl} target="_blank" rel="noreferrer">
                Visit website
              </a>
            </div>
          ) : null}
          {place.email ? (
            <div>
              <span className="eyebrow">EMAIL</span>
              <a href={`mailto:${place.email}`}>{place.email}</a>
            </div>
          ) : null}
        </div>

        <footer className="pitch-detail-card__footer">
          <span>HOOMA · VERIFIED PITCH RENTAL</span>
          <div className="pitch-detail-card__actions">
            {place.phone ? <a href={`tel:${place.phone}`}>Contact venue</a> : null}
            {canManage ? (
              <a className="pitch-owner-link" href={`/pitch/manage?placeId=${encodeURIComponent(place.id)}`}>
                Manage pitch
              </a>
            ) : (
              <button
                className="pitch-claim-link"
                type="button"
                onClick={() => setClaimOpen((value) => !value)}
              >
                Own this pitch?
              </button>
            )}
          </div>
        </footer>
      </article>

      {claimOpen && !canManage ? (
        <form className="panel pitch-claim-form" onSubmit={(event) => void claim(event)}>
          <div>
            <p className="eyebrow">CLAIM THIS PITCH</p>
            <h2>{place.name}</h2>
            <p className="muted">Tell the App Admin how you own or manage this venue.</p>
          </div>
          <label>
            Ownership or management evidence
            <textarea name="evidence" minLength={10} required />
          </label>
          <button type="submit" disabled={claimPending}>
            {claimPending ? "Submitting…" : "Submit claim"}
          </button>
        </form>
      ) : null}

      {message ? <p className="success">{message}</p> : null}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
