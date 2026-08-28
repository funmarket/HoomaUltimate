import type { ModerationDecisionInput } from "@hooma/contracts/moderation";
import type {
  PitchApplicationInput,
  PitchManagementState,
  PitchReviewQueueItem,
  PublicPitch,
} from "@hooma/contracts/pitch";

export interface PitchRepository {
  listApproved(): Promise<readonly PublicPitch[]>;
  getApprovedByPlace(placeId: string): Promise<PublicPitch | null>;
  getManagementState(placeId: string): Promise<Omit<PitchManagementState, "place" | "verifiedOwnership">>;
  submit(
    userId: string,
    placeId: string,
    input: PitchApplicationInput,
  ): Promise<{ id: string; status: string } | null>;
  pending(): Promise<readonly PitchReviewQueueItem[]>;
  review(
    actorUserId: string,
    applicationId: string,
    input: ModerationDecisionInput,
  ): Promise<boolean>;
}
