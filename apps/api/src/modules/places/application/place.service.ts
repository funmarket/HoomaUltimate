import type {
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
  PlaceUpdateInput,
} from "@hooma/contracts/places";
import type { PlatformAdminAccessPort } from "../../../application/platform-admin-access.port.js";
import { AppError } from "../../../http/errors/app-error.js";
import type { PlaceModerationDecision, PlaceRepository } from "./place.repository.js";

export class PlaceService {
  constructor(
    private readonly repository: PlaceRepository,
    private readonly platformAdmin: PlatformAdminAccessPort,
  ) {}

  listPublic() {
    return this.repository.listPublic();
  }

  async getPublic(placeId: string) {
    const place = await this.repository.getApproved(placeId);
    if (!place) throw new AppError(404, "PLACE_NOT_FOUND", "Approved Place not found");
    return place;
  }

  async getManaged(userId: string, placeId: string) {
    await this.requireManage(userId, placeId);
    const place = await this.repository.getManaged(placeId);
    if (!place) throw new AppError(404, "PLACE_NOT_FOUND", "Place not found");
    return place;
  }

  suggest(userId: string, input: PlaceSuggestionInput) {
    return this.repository.suggest(userId, input);
  }

  async update(userId: string, placeId: string, input: PlaceUpdateInput) {
    await this.requireManage(userId, placeId);
    try {
      return await this.repository.update(placeId, input);
    } catch (error) {
      if (error instanceof Error && error.message === "PLACE_ALREADY_EXISTS") {
        throw new AppError(
          409,
          "PLACE_ALREADY_EXISTS",
          "Another canonical Place already matches this identity",
        );
      }
      throw error;
    }
  }

  async archive(userId: string, placeId: string) {
    await this.requireManage(userId, placeId);
    const place = await this.repository.getManaged(placeId);
    if (!place) throw new AppError(404, "PLACE_NOT_FOUND", "Place not found");
    if (place.archivedAt) return { ok: true };
    await this.repository.archive(placeId);
    return { ok: true };
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

  async reviewPlace(userId: string, placeId: string, input: PlaceModerationDecision) {
    await this.platformAdmin.requirePlatformAdmin(userId);
    if (!(await this.repository.reviewPlace(userId, placeId, input))) {
      throw new AppError(
        409,
        "PLACE_REVIEW_NOT_PENDING",
        "This Place review is no longer pending",
      );
    }
    return { ok: true };
  }

  async reviewOwnershipClaim(userId: string, claimId: string, input: PlaceModerationDecision) {
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

  private async requireManage(userId: string, placeId: string): Promise<void> {
    if (await this.repository.canManage(placeId, userId)) return;
    if (await this.platformAdmin.isPlatformAdmin(userId)) return;
    throw new AppError(403, "PLACE_MANAGE_FORBIDDEN", "Place owner or App Admin access required");
  }
}
