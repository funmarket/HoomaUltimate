import { z } from "zod";
import type { PublicPlaceSummary } from "./places.js";

export const placeCapabilityKindSchema = z.literal("PITCH");
export const pitchRentalCurrencySchema = z.enum(["TND", "EUR", "USD"]);

export const pitchSuggestionSchema = z.object({
  hourlyRateMinor: z.number().int().min(0).max(100_000_000),
  currency: pitchRentalCurrencySchema,
});

export const placeCapabilityApplicationSchema = z.object({
  summary: z.string().trim().min(10).max(1500),
  hourlyRateMinor: z.number().int().min(0).max(100_000_000),
  currency: pitchRentalCurrencySchema,
});

export type PlaceCapabilityKind = z.infer<typeof placeCapabilityKindSchema>;
export type PitchRentalCurrency = z.infer<typeof pitchRentalCurrencySchema>;
export type PitchSuggestionInput = z.infer<typeof pitchSuggestionSchema>;
export type PlaceCapabilityApplicationInput = z.infer<typeof placeCapabilityApplicationSchema>;

export interface PublicPlaceCapability {
  readonly id: string;
  readonly kind: PlaceCapabilityKind;
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

export interface PitchCapabilityManagementState {
  readonly approvedPitch: ManagedPitchApprovedState | null;
  readonly pendingApplication: ManagedPitchPendingApplication | null;
  readonly latestRejectedApplication: ManagedPitchRejectedApplication | null;
}

export interface PitchManagementState extends PitchCapabilityManagementState {
  readonly place: PublicPlaceSummary;
  readonly verifiedOwnership: boolean;
}
