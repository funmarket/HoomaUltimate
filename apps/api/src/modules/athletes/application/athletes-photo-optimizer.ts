import type { AthletesPhotoContentType } from "@hooma/contracts/athletes";

export interface AthletesOptimizedPhoto {
  readonly body: Uint8Array;
  readonly contentType: AthletesPhotoContentType;
}

export interface AthletesPhotoOptimizer {
  optimize(
    body: Uint8Array,
    contentType: AthletesPhotoContentType,
  ): Promise<AthletesOptimizedPhoto>;
}
