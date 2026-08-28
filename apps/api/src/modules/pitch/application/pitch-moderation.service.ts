import type { ModerationDecisionInput } from "@hooma/contracts/moderation";
import type { PitchReviewTarget } from "@hooma/contracts/pitch";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";
import type { PitchRepository } from "./pitch.repository.js";

export class PitchModerationService {
  constructor(
    private readonly repository: PitchRepository,
    private readonly platformAdmin: PlatformAdminAuthorizer,
  ) {}

  async pending(userId: string) {
    await this.platformAdmin.requireCapability(userId, "REVIEW_PITCH_APPLICATIONS");
    return this.repository.pending();
  }

  async pendingInitialPlaceIds(userId: string) {
    await this.platformAdmin.requireCapability(userId, "REVIEW_PITCH_APPLICATIONS");
    return this.repository.pendingInitialPlaceIds();
  }

  async review(
    userId: string,
    target: PitchReviewTarget,
    reviewId: string,
    input: ModerationDecisionInput,
  ) {
    await this.platformAdmin.requireCapability(userId, "REVIEW_PITCH_APPLICATIONS");
    try {
      if (!(await this.repository.review(userId, target, reviewId, input))) {
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
