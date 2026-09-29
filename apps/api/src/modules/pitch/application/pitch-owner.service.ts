import type { PitchApplicationInput, PitchManagementState } from "@hooma/contracts/pitch";
import type { PlatformAdminAccessPort } from "../../../application/platform-admin-access.port.js";
import { AppError } from "../../../http/errors/app-error.js";
import type { PitchPlaceAccess } from "./pitch-place-access.js";
import type { PitchRepository } from "./pitch.repository.js";

export class PitchOwnerService {
  constructor(
    private readonly repository: PitchRepository,
    private readonly places: PitchPlaceAccess,
    private readonly platformAdmin: PlatformAdminAccessPort,
  ) {}

  async getManagementState(userId: string, placeId: string): Promise<PitchManagementState> {
    const place = await this.places.getPublic(placeId);

    const verifiedOwnership = await this.places.isVerifiedOwner(placeId, userId);
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
      ...(await this.repository.getManagementState(placeId)),
    };
  }

  async submitRevision(userId: string, placeId: string, input: PitchApplicationInput) {
    const place = await this.places.getPublic(placeId);
    if (!(await this.places.isVerifiedOwner(placeId, userId))) {
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
