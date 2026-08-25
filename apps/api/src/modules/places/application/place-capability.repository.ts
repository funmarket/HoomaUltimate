import type {
  AdminQueueItem,
  ModerationDecisionInput,
  PlaceCapabilityApplicationInput,
  PlaceCapabilityKind,
  PublicPlaceCapability,
} from "@hooma/contracts/platform-management";

export interface PlaceCapabilityRepository {
  listApproved(kind: PlaceCapabilityKind): Promise<readonly PublicPlaceCapability[]>;
  submit(
    userId: string,
    placeId: string,
    kind: PlaceCapabilityKind,
    input: PlaceCapabilityApplicationInput,
  ): Promise<{ id: string; status: string }>;
  pending(kind: PlaceCapabilityKind): Promise<readonly AdminQueueItem[]>;
  review(
    actorUserId: string,
    applicationId: string,
    kind: PlaceCapabilityKind,
    input: ModerationDecisionInput,
  ): Promise<void>;
}
