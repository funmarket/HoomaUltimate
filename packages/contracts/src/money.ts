import { z } from "zod";

export const supportedCashCurrencies = ["TND", "EUR", "USD"] as const;

export const cashCurrencySchema = z.enum(supportedCashCurrencies);

export type CashCurrency = (typeof supportedCashCurrencies)[number];

export const currencyMinorUnitExponent: Record<CashCurrency, number> = {
  TND: 3,
  EUR: 2,
  USD: 2,
};

export const SUPPORTED_CASH_CURRENCIES = supportedCashCurrencies;
