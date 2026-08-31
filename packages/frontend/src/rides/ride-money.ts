import type { CashCurrency } from "@hooma/contracts/money";
import { SUPPORTED_CASH_CURRENCIES, currencyMinorUnitExponent } from "@hooma/contracts/money";

export { SUPPORTED_CASH_CURRENCIES, currencyMinorUnitExponent };
export type { CashCurrency };

export function amountToMinorUnits(rawAmount: string, currency: CashCurrency): number {
  const amount = rawAmount.trim();
  const exponent = currencyMinorUnitExponent[currency];
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) throw new Error("Enter a valid amount");

  const whole = match[1] ?? "0";
  const fractional = match[2] ?? "";
  if (fractional.length > exponent) {
    throw new Error(`Enter up to ${exponent} decimal places for ${currency}`);
  }

  const wholeMinor = BigInt(whole) * 10n ** BigInt(exponent);
  const fractionalMinor = BigInt(fractional.padEnd(exponent, "0") || "0");
  const minorUnits = wholeMinor + fractionalMinor;
  if (minorUnits <= 0n) throw new Error("Amount must be positive");
  if (minorUnits > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Amount is too large");
  return Number(minorUnits);
}

export function minorUnitsToAmountLabel(amountMinor: number, currency: CashCurrency): string {
  const exponent = currencyMinorUnitExponent[currency];
  const scale = 10n ** BigInt(exponent);
  const amount = BigInt(amountMinor);
  const whole = amount / scale;
  const fractional = amount % scale;
  const fractionalLabel = fractional.toString().padStart(exponent, "0").replace(/0+$/, "");
  return `${whole.toString()}${fractionalLabel ? `.${fractionalLabel}` : ""} ${currency}`;
}
