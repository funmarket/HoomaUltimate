import type {
  GearUpListQueryInput,
  GearUpReviewQueueItem,
  GearUpShopSuggestionInput,
  GearUpShopUpdateInput,
  ManagedGearUpShop,
  PublicGearUpShop,
} from "@hooma/contracts/gear-up";
import type { PlaceSuggestionResult } from "@hooma/contracts/places";

export interface GearUpModerationDecision {
  readonly decision: "APPROVE" | "REJECT";
  readonly note?: string | null;
}

export interface GearUpRepository {
  listPublic(input: GearUpListQueryInput): Promise<readonly PublicGearUpShop[]>;
  getPublic(placeId: string): Promise<PublicGearUpShop | null>;
  suggest(userId: string, input: GearUpShopSuggestionInput): Promise<PlaceSuggestionResult>;
  getManaged(placeId: string): Promise<ManagedGearUpShop | null>;
  updateShop(placeId: string, input: GearUpShopUpdateInput): Promise<ManagedGearUpShop | null>;
  pending(): Promise<readonly GearUpReviewQueueItem[]>;
  review(actorUserId: string, placeId: string, input: GearUpModerationDecision): Promise<boolean>;
}
