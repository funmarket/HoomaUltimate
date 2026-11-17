import type { PageBannerPlacementId } from "@hooma/contracts/page-banner";

export interface PrimaryNavigationDestination {
  readonly label: string;
  readonly href: string;
}

const placementByLabel: Readonly<Record<string, PageBannerPlacementId>> = {
  Home: "HOME_TOP",
  Play: "PLAY_TOP",
  Watch: "WATCH_TOP",
  HOOMA: "HOOMA_TOP",
  Athletes: "ATHLETES_TOP",
};

const placementByCanonicalPath: Readonly<Record<string, PageBannerPlacementId>> = {
  "/": "HOME_TOP",
  "/telegram": "HOME_TOP",
  "/play": "PLAY_TOP",
  "/watch": "WATCH_TOP",
  "/hooma": "HOOMA_TOP",
  "/athletes": "ATHLETES_TOP",
  "/teams": "TEAMS_TOP",
  "/pitch": "PITCH_TOP",
  "/places": "PLACES_TOP",
  "/requests": "REQUESTS_TOP",
  "/athletes/gear-up": "GEAR_UP_TOP",
  "/rides": "RIDE_TOP",
};

export function pageBannerPlacementForPath(
  pathname: string,
  destinations: readonly PrimaryNavigationDestination[],
): PageBannerPlacementId | null {
  const canonicalPlacement = placementByCanonicalPath[pathname];
  if (canonicalPlacement) return canonicalPlacement;
  const destination = destinations.find(({ href }) => href === pathname);
  return destination ? (placementByLabel[destination.label] ?? null) : null;
}

export function navigateWithPageBannerPrefetch(
  href: string,
  destinations: readonly PrimaryNavigationDestination[],
  prefetch: (placementId: PageBannerPlacementId) => Promise<unknown>,
  navigate: (href: string) => void,
): void {
  const placementId = pageBannerPlacementForPath(href, destinations);
  if (placementId) void prefetch(placementId).catch(() => undefined);
  navigate(href);
}
