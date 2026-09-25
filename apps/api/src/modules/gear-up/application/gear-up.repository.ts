import type {
  GearUpListQueryInput,
  GearUpShopSuggestionInput,
  GearUpShopUpdateInput,
} from "@hooma/contracts/gear-up";
import type { PlaceSuggestionResult } from "@hooma/contracts/places";

export interface GearUpModerationDecision {
  readonly decision: "APPROVE" | "REJECT";
  readonly note?: string | null;
}

export interface GearUpRepository {
  listPublic(input: GearUpListQueryInput): Promise<readonly unknown[]>;
  getPublic(placeId: string): Promise<unknown | null>;
  suggest(userId: string, input: GearUpShopSuggestionInput): Promise<PlaceSuggestionResult>;
  getManaged(placeId: string): Promise<unknown | null>;
  updateShop(placeId: string, input: GearUpShopUpdateInput): Promise<unknown>;
  pending(): Promise<readonly unknown[]>;
  review(actorUserId: string, placeId: string, input: GearUpModerationDecision): Promise<boolean>;
}
