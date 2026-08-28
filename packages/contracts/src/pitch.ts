import { z } from "zod";
import {
  placeSuggestionSchema,
  type PlaceSuggestionResult,
  type PublicPlaceSummary,
} from "./places.js";

export const pitchRentalCurrencySchema = z.enum(["TND", "EUR", "USD"]);

export const pitchSuggestionSchema = z.object({
  hourlyRateMinor: z.number().int().min(0).max(100_000_000),
  currency: pitchRentalCurrencySchema,
});

export const pitchPlaceSuggestionSchema = z.object({
  place: placeSuggestionSchema.omit({ submissionOrigin: true }),
  pitch: pitchSuggestionSchema,
});

export const pitchApplicationSchema = z.object({
  summary: z.string().trim().min(10).max(1500),
  hourlyRateMinor: z.number().int().min(0).max(100_000_000),
  currency: pitchRentalCurrencySchema,
});

export type PitchRentalCurrency = z.infer<typeof pitchRentalCurrencySchema>;
export type PitchSuggestionInput = z.infer<typeof pitchSuggestionSchema>;
export type PitchPlaceSuggestionInput = z.infer<typeof pitchPlaceSuggestionSchema>;
export type PitchPlaceSuggestionResult = PlaceSuggestionResult;
export type PitchApplicationInput = z.infer<typeof pitchApplicationSchema>;

export interface PublicPitch {
  readonly id: string;
  readonly summary: string | null;
  readonly hourlyRateMinor: number;
  readonly currency: PitchRentalCurrency;
  readonly place: PublicPlaceSummary;
}

export interface ManagedPitchApprovedState {
  readonly id: string;
  readonly summary: string | null;
  readonly hourlyRateMinor: number;
  readonly currency: PitchRentalCurrency;
  readonly approvedAt: string | null;
}

export interface ManagedPitchPendingApplication {
  readonly id: string;
  readonly summary: string;
  readonly hourlyRateMinor: number | null;
  readonly currency: PitchRentalCurrency | null;
  readonly submittedAt: string;
}

export interface ManagedPitchRejectedApplication {
  readonly id: string;
  readonly summary: string;
  readonly hourlyRateMinor: number | null;
  readonly currency: PitchRentalCurrency | null;
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface PitchManagementState {
  readonly place: PublicPlaceSummary;
  readonly verifiedOwnership: boolean;
  readonly approvedPitch: ManagedPitchApprovedState | null;
  readonly pendingApplication: ManagedPitchPendingApplication | null;
  readonly latestRejectedApplication: ManagedPitchRejectedApplication | null;
}
