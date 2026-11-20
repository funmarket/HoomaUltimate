import type { GearUpProductImageContentType } from "@hooma/contracts/gear-up";
import type { ProcessedMediaResult } from "@hooma/media-processing";

export interface GearUpProductImageProcessor {
  process(
    body: Uint8Array,
    contentType: GearUpProductImageContentType,
  ): Promise<ProcessedMediaResult>;
}
