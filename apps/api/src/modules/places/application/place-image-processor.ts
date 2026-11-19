import type { PlaceImageContentType } from "@hooma/contracts/places";
import type { ProcessedMediaResult } from "@hooma/media-processing";

export interface PlaceImageProcessor {
  process(body: Uint8Array, contentType: PlaceImageContentType): Promise<ProcessedMediaResult>;
}
