import type { PitchApplicationInput, PitchManagementState } from "@hooma/contracts/pitch";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlaceRepository } from "../../places/application/place.repository.js";
import type { PitchAccessAuthorizer } from "./pitch-access.authorizer.js";
import type { PitchRepository } from "./pitch.repository.js";

export class PitchOwnerService {
  constructor(
    private readonly repository: PitchRepository,
    private readonly places: PlaceRepository,
    private readonly access: PitchAccessAuthorizer,
  ) {}

  async getManagementState(userId: string, placeId: string): Promise<PitchManagementState> {
    const place = await this.places.getApproved(placeId);
    if (!place) throw new AppError(404, "PLACE_NOT_FOUND", "Approved Place not found");

    const verifiedOwnership = await this.places.hasVerifiedOwnership(placeId, userId);
    if (!verifiedOwnership && !(await this.access.isPlatformAdmin(userId))) {
      throw new AppError(
        403,
        "PITCH_MANAGEMENT_ACCESS_DENIED",
        "Verified Place ownership or platform admin access is required to manage this Pitch",
      );
    }

    return {
      place,
      verifiedOwnership,
      ...(await this.repository.getManagementState(placeId)),
    };
  }

  async submitRevision(userId: string, placeId: string, input: PitchApplicationInput) {
    const place = await this.places.getApproved(placeId);
    if (!place) throw new AppError(404, "PLACE_NOT_FOUND", "Approved Place not found");
    if (!(await this.places.hasVerifiedOwnership(placeId, userId))) {
      throw new AppError(
        403,
        "VERIFIED_PLACE_OWNER_REQUIRED",
        "Verified Place ownership is required before submitting a Pitch application",
      );
    }
    const application = await this.repository.submitRevision(userId, placeId, input);
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
