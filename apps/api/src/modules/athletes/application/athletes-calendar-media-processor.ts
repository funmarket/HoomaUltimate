import type { AthletesPhotoContentType } from "@hooma/contracts/athletes";
import type { ProcessedMediaResult } from "@hooma/media-processing";

export interface AthletesCalendarMediaProcessor {
  process(body: Uint8Array, contentType: AthletesPhotoContentType): Promise<ProcessedMediaResult>;
}
