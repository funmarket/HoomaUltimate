import type {
  RideOfferCompensationTerms,
  RideRequestCompensationTerms,
} from "@hooma/contracts/rides";
import { minorUnitsToAmountLabel } from "./ride-money";

type RideCompensationBadgeProps = {
  readonly terms: RideOfferCompensationTerms | RideRequestCompensationTerms;
  readonly mode?: "offer" | "request";
};

export function RideCompensationBadge({ terms, mode = "offer" }: RideCompensationBadgeProps) {
  if (terms.type === "FREE") {
    return <span className="ride-compensation ride-compensation--free">FREE</span>;
  }

  const suffix = "basis" in terms ? (terms.basis === "PER_SEAT" ? " / SEAT" : " TOTAL") : "";
  const prefix = mode === "request" ? "OFFERING " : "";

  return (
    <span className="ride-compensation">
      {`${prefix}${minorUnitsToAmountLabel(terms.amountMinor, terms.currency)}${suffix}`}
    </span>
  );
}
