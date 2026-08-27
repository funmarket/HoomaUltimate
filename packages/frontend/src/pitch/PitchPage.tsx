import { useEffect, useMemo, useState } from "react";
import type {
  PublicPlaceCapability,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";
import { useHoomaFrontend } from "../context";
import { createPlatformManagementApi } from "../places/platform-management-api";
import { formatPitchHourlyRate } from "./pricing";

function locationLabel(place: PublicPlaceSummary): string {
  return [place.city, place.houma].filter(Boolean).join(" · ") || place.address;
}

export function PitchPage() {
  const { transport } = useHoomaFrontend();
  const api = useMemo(() => createPlatformManagementApi(transport), [transport]);
  const [items, setItems] = useState<PublicPlaceCapability[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    void api.capability
      .list("PITCH")
      .then(setItems)
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load Pitch"),
      );
  }, [api]);

  return (
    <section className="pitch-page">
      <header className="pitch-page__header">
        <div>
          <p className="eyebrow">PITCH</p>
          <h1>Find your pitch</h1>
          <p>Football grounds and rental offers from local venues.</p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <div className="pitch-directory">
        {items.map((item) => {
          const cover = item.place.images[0]?.imageUrl ?? item.place.imageUrl;
          const rate = formatPitchHourlyRate(item.hourlyRateMinor, item.currency);
          return (
            <article className="pitch-rental-card" key={item.id}>
              <div className="pitch-rental-card__body">
                <div className="pitch-rental-card__identity">
                  <p className="pitch-rental-card__location">{locationLabel(item.place)}</p>
                  <h2>{item.place.name}</h2>
                  <p className="pitch-rental-card__summary">{item.summary}</p>
                </div>

                <div className="pitch-rental-card__price" aria-label="Hourly rental price">
                  <strong>{rate}</strong>
                  {item.hourlyRateMinor !== null && item.currency ? (
                    <span>{item.currency} / HOUR</span>
                  ) : null}
                </div>

                <div className="pitch-rental-card__meta">
                  <span>{item.place.address}</span>
                  {item.place.phone ? <span>{item.place.phone}</span> : null}
                </div>
              </div>

              <div className="pitch-rental-card__media">
                {cover ? <img src={cover} alt={item.place.name} /> : <span>HOOMA PITCH</span>}
              </div>

              <div className="pitch-rental-card__footer">
                <span className="pitch-rental-card__stamp">HOOMA · PITCH RENTAL</span>
                <a href={`/pitch/${item.place.id}`}>View pitch</a>
              </div>
            </article>
          );
        })}

        {!items.length && !error ? (
          <div className="pitch-empty panel">
            <h2>No verified pitches yet</h2>
            <p className="muted">Approved football venues will appear here.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
