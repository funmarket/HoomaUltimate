export const MAX_DECODED_PIXELS = 40_000_000;
export const DEFAULT_INTENDED_HTTP_MAX_BYTES = 5 * 1024 * 1024;
export const ACCEPTED_MEDIA_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type MediaInputContentType = (typeof ACCEPTED_MEDIA_CONTENT_TYPES)[number];
export type PhotoVariant = "master" | "card" | "thumb";
export type PageBannerVariant = "master" | "display" | "mobile";
export type MediaVariant = PhotoVariant | PageBannerVariant;

export interface PhotoVariantSpec {
  readonly variant: PhotoVariant;
  readonly maxEdgePx: number;
  readonly quality: number;
}

export interface PageBannerVariantSpec {
  readonly variant: PageBannerVariant;
  readonly maxWidthPx: number;
  readonly maxHeightPx: number;
  readonly quality: number;
}

export interface PhotoStandardProfile {
  readonly id: "PHOTO_STANDARD";
  readonly kind: "photo";
  readonly maxDecodedPixels: number;
  readonly intendedHttpMaxBytes: number;
  readonly acceptedContentTypes: readonly MediaInputContentType[];
  readonly variants: readonly PhotoVariantSpec[];
}

export interface PageBannerStandardProfile {
  readonly id: "PAGE_BANNER_STANDARD";
  readonly kind: "page-banner";
  readonly maxDecodedPixels: number;
  readonly intendedHttpMaxBytes: number;
  readonly acceptedContentTypes: readonly MediaInputContentType[];
  readonly frameRatio: Readonly<{ width: 18; height: 13 }>;
  readonly background: "#050605";
  readonly variants: readonly PageBannerVariantSpec[];
}

export type MediaProcessingProfile = PhotoStandardProfile | PageBannerStandardProfile;

export const PHOTO_STANDARD: PhotoStandardProfile = {
  id: "PHOTO_STANDARD",
  kind: "photo",
  maxDecodedPixels: MAX_DECODED_PIXELS,
  intendedHttpMaxBytes: DEFAULT_INTENDED_HTTP_MAX_BYTES,
  acceptedContentTypes: ACCEPTED_MEDIA_CONTENT_TYPES,
  variants: [
    { variant: "master", maxEdgePx: 2048, quality: 88 },
    { variant: "card", maxEdgePx: 800, quality: 80 },
    { variant: "thumb", maxEdgePx: 400, quality: 75 },
  ],
};

export const PAGE_BANNER_STANDARD: PageBannerStandardProfile = {
  id: "PAGE_BANNER_STANDARD",
  kind: "page-banner",
  maxDecodedPixels: MAX_DECODED_PIXELS,
  intendedHttpMaxBytes: DEFAULT_INTENDED_HTTP_MAX_BYTES,
  acceptedContentTypes: ACCEPTED_MEDIA_CONTENT_TYPES,
  frameRatio: { width: 18, height: 13 },
  background: "#050605",
  variants: [
    { variant: "master", maxWidthPx: 2160, maxHeightPx: 1560, quality: 90 },
    { variant: "display", maxWidthPx: 1440, maxHeightPx: 1040, quality: 88 },
    { variant: "mobile", maxWidthPx: 720, maxHeightPx: 520, quality: 88 },
  ],
};

export function profileFromId(id: MediaProcessingProfile["id"]): MediaProcessingProfile {
  return id === "PHOTO_STANDARD" ? PHOTO_STANDARD : PAGE_BANNER_STANDARD;
}
