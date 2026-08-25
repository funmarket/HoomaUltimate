import type {
  ModerationDecisionInput,
  PlaceCapabilityApplicationInput,
  PlaceCapabilityKind,
  PlatformManagerCapability,
} from "@hooma/contracts/platform-management";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";
import type { PlaceRepository } from "./place.repository.js";
import type { PlaceCapabilityRepository } from "./place-capability.repository.js";

const REVIEW_CAPABILITY: Readonly<Record<PlaceCapabilityKind, PlatformManagerCapability>> = {
  WATCH: "REVIEW_WATCH_APPLICATIONS",
  PITCH: "REVIEW_PITCH_APPLICATIONS",
};

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

  async submit(userId: string, placeId: string, input: PlaceCapabilityApplicationInput) {
    const place = await this.places.getApproved(placeId);
    if (!place) throw new AppError(404, "PLACE_NOT_FOUND", "Approved Place not found");
    if (!(await this.places.hasVerifiedOwnership(placeId, userId))) {
      throw new AppError(
        403,
        "VERIFIED_PLACE_OWNER_REQUIRED",
        "Verified Place ownership is required before submitting a business application",
      );
    }
    return this.repository.submit(userId, placeId, this.kind, input);
  }

  async pending(userId: string) {
    await this.platformAdmin.requireCapability(userId, REVIEW_CAPABILITY[this.kind]);
    return this.repository.pending(this.kind);
  }

  async review(userId: string, applicationId: string, input: ModerationDecisionInput) {
    await this.platformAdmin.requireCapability(userId, REVIEW_CAPABILITY[this.kind]);
    await this.repository.review(userId, applicationId, this.kind, input);
    return { ok: true };
  }
}
