import type { ModerationDecisionInput } from "@hooma/contracts/platform-admin";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlaceCapabilityRepository } from "../../places/application/place-capability.repository.js";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";

export class PitchModerationService {
  constructor(
    private readonly repository: PlaceCapabilityRepository,
    private readonly platformAdmin: PlatformAdminAuthorizer,
  ) {}

  async pending(userId: string) {
    await this.platformAdmin.requireCapability(userId, "REVIEW_PITCH_APPLICATIONS");
    return this.repository.pending("PITCH");
  }

  async review(userId: string, applicationId: string, input: ModerationDecisionInput) {
    await this.platformAdmin.requireCapability(userId, "REVIEW_PITCH_APPLICATIONS");
    try {
      if (!(await this.repository.review(userId, applicationId, "PITCH", input))) {
        throw new AppError(
          409,
          "PITCH_APPLICATION_REVIEW_NOT_PENDING",
          "This Pitch application review is no longer pending",
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message === "PITCH_PRICING_REQUIRED") {
        throw new AppError(
          409,
          "PITCH_PRICING_REQUIRED",
          "This Pitch application cannot be approved without hourly rental price and currency",
        );
      }
      throw error;
    }
    return { ok: true };
  }
}
