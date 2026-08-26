import type {
  ModerationDecisionInput,
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
} from "@hooma/contracts/platform-management";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlatformAdminAuthorizer } from "../../platform-admin/application/platform-admin.authorizer.js";
import type { PlaceRepository } from "./place.repository.js";

export class PlaceService {
  constructor(
    private readonly repository: PlaceRepository,
    private readonly platformAdmin: PlatformAdminAuthorizer,
  ) {}

  listPublic() {
    return this.repository.listPublic();
  }

  async getPublic(placeId: string) {
    const place = await this.repository.getApproved(placeId);
    if (!place) throw new AppError(404, "PLACE_NOT_FOUND", "Approved Place not found");
    return place;
  }

  async suggest(userId: string, input: PlaceSuggestionInput) {
    try {
      return await this.repository.suggest(userId, input);
    } catch (error) {
      if (error instanceof Error && error.message === "PLACE_ALREADY_EXISTS") {
        throw new AppError(
          409,
          "PLACE_ALREADY_EXISTS",
          "A Place with this name and address is already pending or approved",
        );
      }
      throw error;
    }
  }

  async claimOwnership(userId: string, placeId: string, input: PlaceOwnershipClaimInput) {
    const place = await this.repository.getApproved(placeId);
    if (!place) throw new AppError(404, "PLACE_NOT_FOUND", "Approved Place not found");
    if (await this.repository.hasVerifiedOwnership(placeId, userId)) {
      throw new AppError(
        409,
        "PLACE_ALREADY_OWNED",
        "You are already a verified owner of this Place",
      );
    }
    return this.repository.claimOwnership(userId, placeId, input);
  }

  isVerifiedOwner(placeId: string, userId: string) {
    return this.repository.hasVerifiedOwnership(placeId, userId);
  }

  async pendingPlaces(userId: string) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    return this.repository.pendingPlaces();
  }

  async pendingOwnershipClaims(userId: string) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    return this.repository.pendingOwnershipClaims();
  }

  async reviewPlace(userId: string, placeId: string, input: ModerationDecisionInput) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    if (!(await this.repository.reviewPlace(userId, placeId, input))) {
      throw new AppError(409, "PLACE_REVIEW_NOT_PENDING", "This Place review is no longer pending");
    }
    return { ok: true };
  }

  async reviewOwnershipClaim(userId: string, claimId: string, input: ModerationDecisionInput) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    if (!(await this.repository.reviewOwnershipClaim(userId, claimId, input))) {
      throw new AppError(
        409,
        "PLACE_OWNERSHIP_REVIEW_NOT_PENDING",
        "This Place ownership review is no longer pending",
      );
    }
    return { ok: true };
  }
}
