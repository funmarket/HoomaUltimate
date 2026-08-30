import type { PitchPlaceSuggestionInput } from "@hooma/contracts/pitch";
import {
  resolvePlaceImageFields,
  type ExternalPlaceImageResolver,
} from "../../places/application/external-place-image-resolver.js";
import type { PitchRepository } from "./pitch.repository.js";

export class PitchSuggestionService {
  constructor(
    private readonly repository: PitchRepository,
    private readonly imageResolver: ExternalPlaceImageResolver,
  ) {}

  async suggest(userId: string, input: PitchPlaceSuggestionInput) {
    const place = await resolvePlaceImageFields(input.place, this.imageResolver);
    return this.repository.suggestPlace(userId, { ...input, place });
  }
}
