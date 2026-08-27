import type { PitchRentalCurrency } from "@hooma/contracts/platform-management";

const MINOR_UNIT_SCALE: Record<PitchRentalCurrency, number> = {
  TND: 1000,
  EUR: 100,
  USD: 100,
};

export function pitchRateToMinor(amount: number, currency: PitchRentalCurrency): number {
  return Math.round(amount * MINOR_UNIT_SCALE[currency]);
}

export function pitchRateFromMinor(amount: number, currency: PitchRentalCurrency): number {
  return amount / MINOR_UNIT_SCALE[currency];
}

export function formatPitchHourlyRate(
  amountMinor: number | null,
  currency: PitchRentalCurrency | null,
): string {
  if (amountMinor === null || currency === null) return "Contact for price";
  const amount = pitchRateFromMinor(amountMinor, currency);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === "TND" ? 3 : 2,
  }).format(amount);
}
