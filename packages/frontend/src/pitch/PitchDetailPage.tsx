import { useEffect, useMemo, useState } from "react";
import type { PublicPlaceCapability } from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createPlatformManagementApi } from "../places/platform-management-api";
import { formatPitchHourlyRate } from "./pricing";

export function PitchDetailPage({ placeId }: { readonly placeId: string }) {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [item, setItem] = useState<PublicPlaceCapability | null>(null);
  const [loading, setLoading] = useState(true);
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
  }, [api, placeId]);

  if (loading) return <p className="status">Loading pitch…</p>;
  if (error) return <p className="error">{error}</p>;
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
          {place.phone ? <a href={`tel:${place.phone}`}>Contact venue</a> : null}
        </footer>
      </article>
    </section>
  );
}
