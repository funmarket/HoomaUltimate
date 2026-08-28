import { AppError } from "../../../http/errors/app-error.js";
import type { PlaceCapabilityRepository } from "../../places/application/place-capability.repository.js";

export class ApprovedPitchReader {
  constructor(private readonly repository: PlaceCapabilityRepository) {}

  listApproved() {
    return this.repository.listApproved("PITCH");
  }

  async getApproved(placeId: string) {
    const capability = await this.repository.getApprovedByPlace("PITCH", placeId);
    if (!capability) throw new AppError(404, "PITCH_NOT_FOUND", "Approved Pitch not found");
    return capability;
  }
}
