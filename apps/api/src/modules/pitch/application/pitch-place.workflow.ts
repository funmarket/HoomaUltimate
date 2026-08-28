import type { PitchPlaceSuggestionInput, PitchPlaceSuggestionResult } from "@hooma/contracts/pitch";
import type { PitchModerationDecision } from "./pitch.repository.js";

export interface PitchPlaceWorkflow {
  suggestInitial(userId: string, input: PitchPlaceSuggestionInput): Promise<PitchPlaceSuggestionResult>;
  reviewInitial(
    actorUserId: string,
    capabilityId: string,
    input: PitchModerationDecision,
  ): Promise<boolean>;
}
