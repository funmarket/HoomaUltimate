import type { PitchPlaceSuggestionInput, PitchPlaceSuggestionResult } from "@hooma/contracts/pitch";
import { type PrismaClient } from "@hooma/database";
import type { PitchPlaceWorkflow } from "../../modules/pitch/application/pitch-place.workflow.js";
import type { PitchModerationDecision } from "../../modules/pitch/application/pitch.repository.js";
import {
  createPendingPitchCapability,
  reviewPendingInitialPitch,
} from "../../modules/pitch/infrastructure/pitch-initial.persistence.js";
import { suggestCanonicalPlace } from "../../modules/places/infrastructure/canonical-place.persistence.js";
import { reviewPendingPlace } from "../../modules/places/infrastructure/place-moderation.persistence.js";

export class PrismaPitchPlaceWorkflow implements PitchPlaceWorkflow {
  constructor(private readonly db: PrismaClient) {}

  async suggestInitial(
    userId: string,
    input: PitchPlaceSuggestionInput,
  ): Promise<PitchPlaceSuggestionResult> {
    return this.db.$transaction(async (tx) => {
      const result = await suggestCanonicalPlace(tx, userId, input.place, "FANHUB");
      if (result.outcome === "EXISTING") return result;
      await createPendingPitchCapability(tx, result.place.id, input.pitch);
      return result;
    });
  }

  async reviewInitial(
    actorUserId: string,
    capabilityId: string,
    input: PitchModerationDecision,
  ): Promise<boolean> {
    return this.db.$transaction(async (tx) => {
      const pitch = await reviewPendingInitialPitch(tx, actorUserId, capabilityId, input);
      if (!pitch) return false;
      if (!(await reviewPendingPlace(tx, actorUserId, pitch.placeId, input))) {
        throw new Error("PITCH_INITIAL_PLACE_STATE_CHANGED");
      }
      return true;
    });
  }
}
