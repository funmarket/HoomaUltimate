import type {
  RideOfferCompensationTerms,
  RideRequestCompensationTerms,
} from "@hooma/contracts/rides";

type RideCompensationBadgeProps = {
  readonly terms: RideOfferCompensationTerms | RideRequestCompensationTerms;
  readonly mode?: "offer" | "request";
};

function money(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  return `${Number.isInteger(amount) ? amount.toFixed(0) : amount.toFixed(2)} ${currency}`;
}

export function RideCompensationBadge({ terms, mode = "offer" }: RideCompensationBadgeProps) {
  if (terms.type === "FREE") {
    return <span className="ride-compensation ride-compensation--free">FREE</span>;
  }

  const suffix = "basis" in terms ? (terms.basis === "PER_SEAT" ? " / SEAT" : " TOTAL") : "";
  const prefix = mode === "request" ? "OFFERING " : "";

  return (
    <span className="ride-compensation">{`${prefix}${money(terms.amountMinor, terms.currency)}${suffix}`}</span>
  );
}
