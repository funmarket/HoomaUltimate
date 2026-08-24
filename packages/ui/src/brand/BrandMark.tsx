import { HOOMA_WORDMARK } from "./brand-assets.js";

export interface BrandMarkProps {
  readonly className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <img
      className={className}
      src={HOOMA_WORDMARK.src}
      width={HOOMA_WORDMARK.width}
      height={HOOMA_WORDMARK.height}
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable={false}
      style={{
        display: "block",
        width: "clamp(138px, 44vw, 205px)",
        maxWidth: "100%",
        height: "auto",
        maxHeight: "50px",
        objectFit: "contain",
        objectPosition: "left center",
      }}
    />
  );
}
