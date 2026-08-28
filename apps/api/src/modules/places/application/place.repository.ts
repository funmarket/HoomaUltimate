import type {
  ManagedPlaceSummary,
  PlaceOwnershipClaimInput,
  PlaceOwnershipReviewQueueItem,
  PlaceReviewQueueItem,
  PlaceSuggestionInput,
  PlaceSuggestionResult,
  PlaceUpdateInput,
  PublicPlaceSummary,
} from "@hooma/contracts/places";

export interface PlaceModerationDecision {
  readonly decision: "APPROVE" | "REJECT";
  readonly note?: string | null;
}

export interface PlaceRepository {
  listPublic(): Promise<readonly PublicPlaceSummary[]>;
  suggest(userId: string, input: PlaceSuggestionInput): Promise<PlaceSuggestionResult>;
  getApproved(placeId: string): Promise<PublicPlaceSummary | null>;
  getManaged(placeId: string): Promise<ManagedPlaceSummary | null>;
  canManage(placeId: string, userId: string): Promise<boolean>;
  update(placeId: string, input: PlaceUpdateInput): Promise<ManagedPlaceSummary>;
  archive(placeId: string): Promise<void>;
  hasVerifiedOwnership(placeId: string, userId: string): Promise<boolean>;
  claimOwnership(
    userId: string,
    placeId: string,
    input: PlaceOwnershipClaimInput,
  ): Promise<{ id: string; status: string }>;
  pendingPlaces(): Promise<readonly PlaceReviewQueueItem[]>;
  pendingOwnershipClaims(): Promise<readonly PlaceOwnershipReviewQueueItem[]>;
  reviewPlace(
    actorUserId: string,
    placeId: string,
    input: PlaceModerationDecision,
  ): Promise<boolean>;
  reviewOwnershipClaim(
    actorUserId: string,
    claimId: string,
    input: PlaceModerationDecision,
  ): Promise<boolean>;
}
