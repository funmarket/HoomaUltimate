import type { PitchRentalCurrency } from "@hooma/contracts/pitch";
import { currencyMinorUnitExponent } from "@hooma/contracts/money";

export function pitchRateToMinor(amount: number, currency: PitchRentalCurrency): number {
  return Math.round(amount * 10 ** currencyMinorUnitExponent[currency]);
}

export function pitchRateFromMinor(amount: number, currency: PitchRentalCurrency): number {
  return amount / 10 ** currencyMinorUnitExponent[currency];
}

export function formatPitchHourlyRate(amountMinor: number, currency: PitchRentalCurrency): string {
  const amount = pitchRateFromMinor(amountMinor, currency);
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === "TND" ? 3 : 2,
  }).format(amount);
}
