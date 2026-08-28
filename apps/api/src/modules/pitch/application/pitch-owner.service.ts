import type { PitchManagementState, PlaceCapabilityApplicationInput } from "@hooma/contracts/pitch";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlaceCapabilityRepository } from "../../places/application/place-capability.repository.js";
import type { PlaceRepository } from "../../places/application/place.repository.js";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";

export class PitchOwnerService {
  constructor(
    private readonly repository: PlaceCapabilityRepository,
    private readonly places: PlaceRepository,
    private readonly platformAdmin: PlatformAdminAuthorizer,
  ) {}

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
      ...(await this.repository.getManagementState("PITCH", placeId)),
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
    const application = await this.repository.submit(userId, placeId, "PITCH", input);
    if (!application) {
      throw new AppError(
        409,
        "PITCH_APPLICATION_ALREADY_PENDING",
        "This Pitch already has an application pending review",
      );
    }
    return application;
  }
}
