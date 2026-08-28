import type { PitchPlaceSuggestionInput } from "@hooma/contracts/pitch";
import type { PitchPlaceWorkflow } from "./pitch-place.workflow.js";

export class PitchSuggestionService {
  constructor(private readonly workflow: PitchPlaceWorkflow) {}

  suggest(userId: string, input: PitchPlaceSuggestionInput) {
    return this.workflow.suggestInitial(userId, input);
  }
}
