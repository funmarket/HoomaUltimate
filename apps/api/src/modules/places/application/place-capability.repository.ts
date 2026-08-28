import type {
  PitchCapabilityManagementState,
  PlaceCapabilityApplicationInput,
  PlaceCapabilityKind,
  PublicPlaceCapability,
} from "@hooma/contracts/pitch";
import type { AdminQueueItem, ModerationDecisionInput } from "@hooma/contracts/platform-admin";

export interface PlaceCapabilityRepository {
  listApproved(kind: PlaceCapabilityKind): Promise<readonly PublicPlaceCapability[]>;
  getApprovedByPlace(
    kind: PlaceCapabilityKind,
    placeId: string,
  ): Promise<PublicPlaceCapability | null>;
  getManagementState(
    kind: PlaceCapabilityKind,
    placeId: string,
  ): Promise<PitchCapabilityManagementState>;
  submit(
    userId: string,
    placeId: string,
    kind: PlaceCapabilityKind,
    input: PlaceCapabilityApplicationInput,
  ): Promise<{ id: string; status: string } | null>;
  pending(kind: PlaceCapabilityKind): Promise<readonly AdminQueueItem[]>;
  review(
    actorUserId: string,
    applicationId: string,
    kind: PlaceCapabilityKind,
    input: ModerationDecisionInput,
  ): Promise<boolean>;
}
