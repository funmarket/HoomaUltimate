import type { PitchPlaceSuggestionInput } from "@hooma/contracts/pitch";
import type { PitchRepository } from "./pitch.repository.js";

export class PitchSuggestionService {
  constructor(private readonly repository: PitchRepository) {}

  suggest(userId: string, input: PitchPlaceSuggestionInput) {
    return this.repository.suggestPlace(userId, input);
  }
}
