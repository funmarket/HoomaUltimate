import type { PlaceImageContentType } from "@hooma/contracts/places";

export interface ProcessedPlaceImage {
  readonly body: Uint8Array;
  readonly contentType: PlaceImageContentType;
}

export interface PlaceImageProcessor {
  process(body: Uint8Array, contentType: PlaceImageContentType): Promise<ProcessedPlaceImage>;
}
