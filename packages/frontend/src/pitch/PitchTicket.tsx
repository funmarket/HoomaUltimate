import { useMemo, useState } from "react";
import type { PublicPlaceCapability } from "@hooma/contracts/platform-management";
import { FitSingleLineText } from "../ui/FitSingleLineText";
import { formatPitchHourlyRate } from "./pricing";

function locationLabel(item: PublicPlaceCapability): string {
  const { place } = item;
  return [place.city, place.houma].filter(Boolean).join(" · ") || place.address;
}

function imageCandidates(item: PublicPlaceCapability): string[] {
  const candidates = item.place.images.map((image) => image.imageUrl);
  if (item.place.imageUrl && !candidates.includes(item.place.imageUrl)) {
    candidates.push(item.place.imageUrl);
  }
  return candidates;
}

export function PitchTicket({ item }: { readonly item: PublicPlaceCapability }) {
  const images = useMemo(() => imageCandidates(item), [item]);
  const [imageIndex, setImageIndex] = useState(0);
  const cover = images[imageIndex] ?? null;
  const hasHourlyRate = item.hourlyRateMinor !== null && item.currency !== null;
  const rate = formatPitchHourlyRate(item.hourlyRateMinor, item.currency);
  const contact = item.place.phone || item.place.email || "Contact venue";

  function showNextImage() {
    setImageIndex((current) => (current + 1 < images.length ? current + 1 : images.length));
  }

  return (
    <article className="pitch-ticket">
      <a
        className="pitch-ticket__link"
        href={`/pitch/${item.place.id}`}
        aria-label={`View ${item.place.name}`}
      >
        <div className="pitch-ticket__paper">
          <div className="pitch-ticket__information">
            <div className="pitch-ticket__main">
              <div className="pitch-ticket__identity">
                <p className="pitch-ticket__eyebrow">PITCH RENTAL</p>
                <div className="pitch-ticket__name-wrap">
                  <FitSingleLineText
                    text={item.place.name}
                    className="pitch-ticket__name"
                    minFontSize={25}
                    maxFontSize={46}
                  />
                </div>
                <p className="pitch-ticket__location">{locationLabel(item)}</p>
              </div>

              <div
                className={`pitch-ticket__rate${hasHourlyRate ? "" : " pitch-ticket__rate--contact"}`}
              >
                <span className="pitch-ticket__rate-label">HOURLY RATE</span>
                {hasHourlyRate ? (
                  <div className="pitch-ticket__rate-value">
                    <strong>{rate}</strong>
                    <span>{item.currency}</span>
                  </div>
                ) : (
                  <strong>{rate}</strong>
                )}
                <span className="pitch-ticket__rate-period">/ hour</span>
                <span className="pitch-ticket__offer">FULL PITCH RENTAL</span>
              </div>
            </div>

            <dl className="pitch-ticket__facts">
              <div>
                <dt>Address</dt>
                <dd>{item.place.address}</dd>
              </div>
              <div>
                <dt>Houma</dt>
                <dd>{item.place.houma || item.place.city || item.place.name}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>{contact}</dd>
              </div>
            </dl>
          </div>

          <aside className="pitch-ticket__stub" aria-label="HOOMA Pitch">
            <img src="/brand/hooma-pitch-stub.svg" alt="HOOMA" />
          </aside>
        </div>

        <div className="pitch-ticket__photo">
          {cover ? (
            <img
              src={cover}
              alt={`${item.place.name} pitch`}
              referrerPolicy="no-referrer"
              onError={showNextImage}
            />
          ) : (
            <div className="pitch-ticket__photo-empty">
              <img src="/brand/hooma-wordmark.webp" alt="" />
              <span>Pitch photo unavailable</span>
            </div>
          )}
        </div>
      </a>
    </article>
  );
}
