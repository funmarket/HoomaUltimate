import type { ModerationDecisionInput } from "@hooma/contracts/moderation";
import type {
  PitchApplicationInput,
  PitchManagementState,
  PitchPlaceSuggestionInput,
  PitchPlaceSuggestionResult,
  PitchReviewQueueItem,
  PitchReviewTarget,
  PublicPitch,
} from "@hooma/contracts/pitch";

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
  pending(): Promise<readonly PitchReviewQueueItem[]>;
  pendingInitialPlaceIds(): Promise<readonly string[]>;
  review(
    actorUserId: string,
    target: PitchReviewTarget,
    reviewId: string,
    input: ModerationDecisionInput,
  ): Promise<boolean>;
}
