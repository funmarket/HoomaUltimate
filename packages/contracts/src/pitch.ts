import { z } from "zod";
import { cashCurrencySchema } from "./money.js";
import {
  placeSuggestionSchema,
  type PlaceSuggestionResult,
  type PublicPlaceSummary,
} from "./places.js";

export const pitchCapabilityKindSchema = z.literal("PITCH");
export const pitchRentalCurrencySchema = cashCurrencySchema;
export const pitchReviewTargetSchema = z.enum(["INITIAL_SUGGESTION", "OWNER_REVISION"]);

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

export type PitchCapabilityKind = z.infer<typeof pitchCapabilityKindSchema>;
export type PitchRentalCurrency = z.infer<typeof pitchRentalCurrencySchema>;
export type PitchReviewTarget = z.infer<typeof pitchReviewTargetSchema>;
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
