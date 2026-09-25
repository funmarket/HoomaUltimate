import type { GearUpProductImageContentType } from "@hooma/contracts/gear-up";

export interface ProcessedGearUpProductImage {
  readonly body: Uint8Array;
  readonly contentType: GearUpProductImageContentType;
}

export interface GearUpProductImageProcessor {
  process(
    body: Uint8Array,
    contentType: GearUpProductImageContentType,
  ): Promise<ProcessedGearUpProductImage>;
}
