import type { ImgHTMLAttributes } from "react";

type ResponsiveRideIconAsset = {
  readonly src: string;
  readonly srcSet: string;
};

function rideIconAsset(name: string): ResponsiveRideIconAsset {
  return {
    src: `/rides/icons/${name}-160.webp`,
    srcSet: `/rides/icons/${name}-160.webp 160w, /rides/icons/${name}-256.webp 256w`,
  };
}

export const RIDE_EXACT_ICON_ASSETS = {
  requestAction: rideIconAsset("request-action"),
  browseOffers: rideIconAsset("browse-offers"),
  offerSeats: rideIconAsset("offer-seats"),
  privacy: rideIconAsset("privacy-lock"),
  matchday: rideIconAsset("matchday-ride"),
  anywhere: rideIconAsset("anywhere-ride"),
  requestFeature: rideIconAsset("request-ride"),
  myRides: rideIconAsset("my-rides"),
} as const;

type RideIconProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "alt" | "src" | "srcSet">;

function RideExactIcon({
  asset,
  sizes = "54px",
  ...props
}: RideIconProps & { readonly asset: ResponsiveRideIconAsset }) {
  return (
    <img
      alt=""
      aria-hidden="true"
      decoding="async"
      draggable="false"
      loading="eager"
      sizes={sizes}
      src={asset.src}
      srcSet={asset.srcSet}
      {...props}
    />
  );
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
