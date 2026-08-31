import type { ImgHTMLAttributes } from "react";

export const RIDE_EXACT_ICON_ASSETS = {
  requestAction: "/rides/icons/request-action.png",
  browseOffers: "/rides/icons/browse-offers.png",
  offerSeats: "/rides/icons/offer-seats.png",
  privacy: "/rides/icons/privacy-lock.png",
  matchday: "/rides/icons/matchday-ride.png",
  anywhere: "/rides/icons/anywhere-ride.png",
  requestFeature: "/rides/icons/request-ride.png",
  myRides: "/rides/icons/my-rides.png",
} as const;

type RideIconProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "src">;

function RideExactIcon({ asset, ...props }: RideIconProps & { readonly asset: string }) {
  return <img alt="" aria-hidden="true" draggable="false" src={asset} {...props} />;
}

export function RideMapPinIcon(props: RideIconProps) {
  return <RideExactIcon asset={RIDE_EXACT_ICON_ASSETS.requestAction} {...props} />;
}

export function RideBrowseIcon(props: RideIconProps) {
  return <RideExactIcon asset={RIDE_EXACT_ICON_ASSETS.browseOffers} {...props} />;
}

export function RideCarPlusIcon(props: RideIconProps) {
  return <RideExactIcon asset={RIDE_EXACT_ICON_ASSETS.offerSeats} {...props} />;
}

export function RideLockIcon(props: RideIconProps) {
  return <RideExactIcon asset={RIDE_EXACT_ICON_ASSETS.privacy} {...props} />;
}

export function RideStadiumIcon(props: RideIconProps) {
  return <RideExactIcon asset={RIDE_EXACT_ICON_ASSETS.matchday} {...props} />;
}

export function RideRouteIcon(props: RideIconProps) {
  return <RideExactIcon asset={RIDE_EXACT_ICON_ASSETS.anywhere} {...props} />;
}

export function RideMapPinPlusIcon(props: RideIconProps) {
  return <RideExactIcon asset={RIDE_EXACT_ICON_ASSETS.requestFeature} {...props} />;
}

export function RideHistoryIcon(props: RideIconProps) {
  return <RideExactIcon asset={RIDE_EXACT_ICON_ASSETS.myRides} {...props} />;
}
