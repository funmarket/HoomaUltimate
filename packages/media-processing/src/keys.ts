import { MediaProcessingError } from "./errors.js";
import type { MediaProcessingProfile, MediaVariant } from "./profiles.js";

export const MEDIA_NAMESPACES = {
  ATHLETES_PHOTO: "athletes-photo",
  ATHLETES_CALENDAR: "athletes-calendar",
  REQUEST_PHOTO: "request-photo",
  GEAR_UP_PRODUCT: "gear-up-product",
  PLACE_PHOTO: "place-photo",
  RIDE_VEHICLE: "ride-vehicle",
  COMMUNITY_LOGO: "community-logo",
  COMMUNITY_BANNER: "community-banner",
  ATHLETES_COMMUNITY_LOGO: "athletes-community-logo",
  ATHLETES_COMMUNITY_BANNER: "athletes-community-banner",
  TEAM_BADGE: "team-badge",
  TEAM_BANNER: "team-banner",
  PROFILE_AVATAR: "profile-avatar",
  WATCH_MEDIA: "watch-media",
  DONATION_PHOTO: "donation-photo",
  PAGE_BANNER: "page-banner",
} as const;

export type MediaNamespace = keyof typeof MEDIA_NAMESPACES;
export type MediaStorageScope = "production" | "staging" | "development";

export interface MediaIdentity {
  readonly scope: MediaStorageScope;
  readonly namespace: MediaNamespace;
  readonly ownerId: string;
  readonly mediaId: string;
}

export interface MediaObjectKeyInput extends MediaIdentity {
  readonly variant: MediaVariant;
}

export interface PlannedMediaObject {
  readonly variant: MediaVariant;
  readonly objectKey: string;
}

const STORAGE_SCOPES = new Set<MediaStorageScope>(["production", "staging", "development"]);
const MEDIA_VARIANTS = new Set<MediaVariant>(["master", "card", "thumb", "display", "mobile"]);
const SAFE_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function namespacePath(namespace: MediaNamespace): string {
  if (!Object.prototype.hasOwnProperty.call(MEDIA_NAMESPACES, namespace)) {
    throw new MediaProcessingError("UNKNOWN_NAMESPACE", "Unknown media namespace");
  }
  return MEDIA_NAMESPACES[namespace];
}

function assertScope(scope: MediaStorageScope): void {
  if (!STORAGE_SCOPES.has(scope)) {
    throw new MediaProcessingError("UNKNOWN_SCOPE", "Unknown media storage scope");
  }
}

function assertIdentifier(value: string, name: string): void {
  if (!SAFE_IDENTIFIER.test(value) || value.includes("..")) {
    throw new MediaProcessingError(
      "UNSAFE_IDENTIFIER",
      `${name} is not safe for object-key construction`,
    );
  }
}

function assertVariant(variant: MediaVariant): void {
  if (!MEDIA_VARIANTS.has(variant)) {
    throw new MediaProcessingError("UNKNOWN_VARIANT", "Unknown media variant");
  }
}

export function buildMediaObjectKey(input: MediaObjectKeyInput): string {
  assertScope(input.scope);
  const path = namespacePath(input.namespace);
  assertIdentifier(input.ownerId, "ownerId");
  assertIdentifier(input.mediaId, "mediaId");
  assertVariant(input.variant);
  return `${input.scope}/media/v1/${path}/${input.ownerId}/${input.mediaId}/${input.variant}.webp`;
}

export function planMediaObjectKeys(
  input: MediaIdentity & { readonly profile: MediaProcessingProfile },
): readonly PlannedMediaObject[] {
  return input.profile.variants.map(({ variant }) => ({
    variant,
    objectKey: buildMediaObjectKey({ ...input, variant }),
  }));
}
