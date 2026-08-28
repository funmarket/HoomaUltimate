import { AppError } from "../../../http/errors/app-error.js";
import type { PitchAccessAuthorizer } from "./pitch-access.authorizer.js";
import type { PitchPlaceWorkflow } from "./pitch-place.workflow.js";
import type {
  PitchModerationDecision,
  PitchRepository,
  PitchReviewTarget,
} from "./pitch.repository.js";

export class PitchModerationService {
  constructor(
    private readonly repository: PitchRepository,
    private readonly access: PitchAccessAuthorizer,
    private readonly workflow: PitchPlaceWorkflow,
  ) {}

  async pending(userId: string) {
    await this.access.requireCapability(userId, "REVIEW_PITCH_APPLICATIONS");
    return this.repository.pending();
  }

  async pendingInitialPlaceIds(userId: string) {
    await this.access.requireCapability(userId, "REVIEW_PITCH_APPLICATIONS");
    return this.repository.pendingInitialPlaceIds();
  }

  async review(
    userId: string,
    target: PitchReviewTarget,
    reviewId: string,
    input: PitchModerationDecision,
  ) {
    await this.access.requireCapability(userId, "REVIEW_PITCH_APPLICATIONS");
    try {
      const reviewed =
        target === "INITIAL_SUGGESTION"
          ? await this.workflow.reviewInitial(userId, reviewId, input)
          : await this.repository.reviewOwnerRevision(userId, reviewId, input);
      if (!reviewed) {
        throw new AppError(
          409,
          "PITCH_REVIEW_NOT_PENDING",
          "This Pitch review is no longer pending",
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message === "PITCH_PRICING_REQUIRED") {
        throw new AppError(
          409,
          "PITCH_PRICING_REQUIRED",
          "This Pitch cannot be approved without hourly rental price and currency",
        );
      }
      if (error instanceof Error && error.message === "PITCH_INITIAL_PLACE_STATE_CHANGED") {
        throw new AppError(
          409,
          "PITCH_INITIAL_PLACE_STATE_CHANGED",
          "The canonical Place state changed while this Pitch review was being claimed",
        );
      }
      throw error;
    }
    return { ok: true };
  }
}
