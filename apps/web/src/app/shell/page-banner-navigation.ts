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

export function pageBannerPlacementForPath(
  pathname: string,
  destinations: readonly PrimaryNavigationDestination[],
): PageBannerPlacementId | null {
  const destination = destinations
    .filter(({ href }) =>
      href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`),
    )
    .sort((left, right) => right.href.length - left.href.length)[0];
  return destination ? (placementByLabel[destination.label] ?? null) : null;
}

export function navigateWithPageBannerPrefetch(
  href: string,
  destinations: readonly PrimaryNavigationDestination[],
  prefetch: (placementId: PageBannerPlacementId) => Promise<unknown>,
  navigate: (href: string) => void,
): void {
  const destination = destinations.find((item) => item.href === href);
  const placementId = destination ? (placementByLabel[destination.label] ?? null) : null;
  if (placementId) void prefetch(placementId).catch(() => undefined);
  navigate(href);
}
