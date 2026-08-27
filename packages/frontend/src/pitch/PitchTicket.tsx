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
  const rate = formatPitchHourlyRate(item.hourlyRateMinor, item.currency);
  const summary = item.summary ?? item.place.description;

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
            <p className="pitch-ticket__eyebrow">PITCH RENTAL</p>
            <div className="pitch-ticket__name-wrap">
              <FitSingleLineText
                text={item.place.name}
                className="pitch-ticket__name"
                minFontSize={25}
                maxFontSize={42}
              />
            </div>
            <p className="pitch-ticket__location">{locationLabel(item)}</p>

            <div className="pitch-ticket__rate">
              <strong>{rate}</strong>
              {item.hourlyRateMinor !== null && item.currency ? (
                <span>{item.currency} / hour</span>
              ) : null}
            </div>

            {summary ? <p className="pitch-ticket__summary">{summary}</p> : null}

            <dl className="pitch-ticket__facts">
              <div>
                <dt>Address</dt>
                <dd>{item.place.address}</dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>{item.place.phone || item.place.email || "Contact venue"}</dd>
              </div>
            </dl>
          </div>

          <aside className="pitch-ticket__stub" aria-hidden="true">
            <img src="/brand/hooma-wordmark.webp" alt="" />
            <span>PITCH</span>
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
