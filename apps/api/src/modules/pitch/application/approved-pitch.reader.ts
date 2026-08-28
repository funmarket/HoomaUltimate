import { AppError } from "../../../http/errors/app-error.js";
import type { PitchRepository } from "./pitch.repository.js";

export class ApprovedPitchReader {
  constructor(private readonly repository: PitchRepository) {}

  listApproved() {
    return this.repository.listApproved();
  }

  async getApproved(placeId: string) {
    const pitch = await this.repository.getApprovedByPlace(placeId);
    if (!pitch) throw new AppError(404, "PITCH_NOT_FOUND", "Approved Pitch not found");
    return pitch;
  }
}
