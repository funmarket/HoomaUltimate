import type {
  ModerationDecisionInput,
  PitchManagementState,
  PlaceCapabilityApplicationInput,
  PlaceCapabilityKind,
} from "@hooma/contracts/platform-management";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";
import type { PlaceRepository } from "./place.repository.js";
import type { PlaceCapabilityRepository } from "./place-capability.repository.js";

export class PlaceCapabilityService {
  constructor(
    readonly kind: PlaceCapabilityKind,
    private readonly repository: PlaceCapabilityRepository,
    private readonly places: PlaceRepository,
    private readonly platformAdmin: PlatformAdminAuthorizer,
  ) {}

  listPublic() {
    return this.repository.listApproved(this.kind);
  }

  async getPublic(placeId: string) {
    const capability = await this.repository.getApprovedByPlace(this.kind, placeId);
    if (!capability) throw new AppError(404, "PITCH_NOT_FOUND", "Approved Pitch not found");
    return capability;
  }

  async getManagementState(userId: string, placeId: string): Promise<PitchManagementState> {
    const place = await this.places.getApproved(placeId);
    if (!place) throw new AppError(404, "PLACE_NOT_FOUND", "Approved Place not found");

    const verifiedOwnership = await this.places.hasVerifiedOwnership(placeId, userId);
    if (!verifiedOwnership && !(await this.platformAdmin.isPlatformAdmin(userId))) {
      throw new AppError(
        403,
        "PITCH_MANAGEMENT_ACCESS_DENIED",
        "Verified Place ownership or platform admin access is required to manage this Pitch",
      );
    }

    return {
      place,
      verifiedOwnership,
      ...(await this.repository.getManagementState(this.kind, placeId)),
    };
  }

  async submit(userId: string, placeId: string, input: PlaceCapabilityApplicationInput) {
    const place = await this.places.getApproved(placeId);
    if (!place) throw new AppError(404, "PLACE_NOT_FOUND", "Approved Place not found");
    if (!(await this.places.hasVerifiedOwnership(placeId, userId))) {
      throw new AppError(
        403,
        "VERIFIED_PLACE_OWNER_REQUIRED",
        "Verified Place ownership is required before submitting a Pitch application",
      );
    }
    const application = await this.repository.submit(userId, placeId, this.kind, input);
    if (!application) {
      throw new AppError(
        409,
        "PITCH_APPLICATION_ALREADY_PENDING",
        "This Pitch already has an application pending review",
      );
    }
    return application;
  }

  async pending(userId: string) {
    await this.platformAdmin.requireCapability(userId, "REVIEW_PITCH_APPLICATIONS");
    return this.repository.pending(this.kind);
  }

  async review(userId: string, applicationId: string, input: ModerationDecisionInput) {
    await this.platformAdmin.requireCapability(userId, "REVIEW_PITCH_APPLICATIONS");
    try {
      if (!(await this.repository.review(userId, applicationId, this.kind, input))) {
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
