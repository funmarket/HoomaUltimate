import type {
  PitchApplicationInput,
  PitchManagementState,
  PitchPlaceSuggestionInput,
  PitchPlaceSuggestionResult,
  PitchRentalCurrency,
  PublicPitch,
} from "@hooma/contracts/pitch";
import type { PublicPlaceSummary } from "@hooma/contracts/places";

export type PitchReviewTarget = "INITIAL_SUGGESTION" | "OWNER_REVISION";

export interface PitchModerationDecision {
  readonly decision: "APPROVE" | "REJECT";
  readonly note?: string | null;
}

export interface PendingPitchReview {
  readonly id: string;
  readonly target: PitchReviewTarget;
  readonly status: "PENDING" | "APPROVED" | "REJECTED";
  readonly placeStatus?: "PENDING" | "APPROVED" | "REJECTED";
  readonly summary: string | null;
  readonly hourlyRateMinor: number | null;
  readonly currency: PitchRentalCurrency | null;
  readonly createdAt: string;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly applicant: {
    readonly userId: string;
    readonly username: string;
    readonly displayName: string;
  };
  readonly place: PublicPlaceSummary;
}

export interface PitchRepository {
  listApproved(): Promise<readonly PublicPitch[]>;
  getApprovedByPlace(placeId: string): Promise<PublicPitch | null>;
  suggestPlace(userId: string, input: PitchPlaceSuggestionInput): Promise<PitchPlaceSuggestionResult>;
  getManagementState(
    placeId: string,
  ): Promise<Omit<PitchManagementState, "place" | "verifiedOwnership">>;
  submitRevision(
    userId: string,
    placeId: string,
    input: PitchApplicationInput,
  ): Promise<{ id: string; status: string } | null>;
  pending(): Promise<readonly PendingPitchReview[]>;
  pendingInitialPlaceIds(): Promise<readonly string[]>;
  review(
    actorUserId: string,
    target: PitchReviewTarget,
    reviewId: string,
    input: PitchModerationDecision,
  ): Promise<boolean>;
}
