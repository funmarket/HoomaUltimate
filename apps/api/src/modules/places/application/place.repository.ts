import type {
  AdminQueueItem,
  ModerationDecisionInput,
  PlaceOwnershipClaimInput,
  PlaceSuggestionInput,
  PublicPlaceSummary,
} from "@hooma/contracts/platform-management";

export interface PlaceRepository {
  listPublic(): Promise<readonly PublicPlaceSummary[]>;
  suggest(userId: string, input: PlaceSuggestionInput): Promise<PublicPlaceSummary & { status: string }>;
  getApproved(placeId: string): Promise<PublicPlaceSummary | null>;
  hasVerifiedOwnership(placeId: string, userId: string): Promise<boolean>;
  claimOwnership(
    userId: string,
    placeId: string,
    input: PlaceOwnershipClaimInput,
  ): Promise<{ id: string; status: string }>;
  pendingPlaces(): Promise<readonly AdminQueueItem[]>;
  pendingOwnershipClaims(): Promise<readonly AdminQueueItem[]>;
  reviewPlace(
    actorUserId: string,
    placeId: string,
    input: ModerationDecisionInput,
  ): Promise<boolean>;
  reviewOwnershipClaim(
    actorUserId: string,
    claimId: string,
    input: ModerationDecisionInput,
  ): Promise<boolean>;
}
