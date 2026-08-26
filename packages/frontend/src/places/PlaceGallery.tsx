import { useState } from "react";
import type { PublicPlaceSummary } from "@hooma/contracts/platform-management";
import "./place-gallery.css";

export function PlaceGallery({ place }: { readonly place: PublicPlaceSummary }) {
  const source = place.images.length
    ? place.images.map((image) => image.imageUrl)
    : place.imageUrl
      ? [place.imageUrl]
      : [];
  const [activeIndex, setActiveIndex] = useState(0);
  if (!source.length) return null;

  const active = Math.min(activeIndex, source.length - 1);
  const showControls = source.length > 1;

  return (
    <section className="place-gallery" aria-label={`${place.name} photos`}>
      <div className="place-gallery__frame">
        <img src={source[active]} alt={`${place.name} photo ${active + 1}`} />
        {showControls ? (
          <>
            <button
              className="place-gallery__arrow place-gallery__arrow--previous"
              type="button"
              aria-label="Previous photo"
              onClick={() => setActiveIndex((index) => (index - 1 + source.length) % source.length)}
            >
              ‹
            </button>
            <button
              className="place-gallery__arrow place-gallery__arrow--next"
              type="button"
              aria-label="Next photo"
              onClick={() => setActiveIndex((index) => (index + 1) % source.length)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      {showControls ? (
        <div className="place-gallery__dots" aria-label="Choose Place photo">
          {source.map((imageUrl, index) => (
            <button
              type="button"
              key={`${imageUrl}-${index}`}
              className={index === active ? "is-active" : ""}
              aria-label={`Show photo ${index + 1}`}
              aria-current={index === active ? "true" : undefined}
              onClick={() => setActiveIndex(index)}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
