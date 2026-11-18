import type { RequestImageContentType } from "@hooma/contracts/requests";
import type { ProcessedMediaResult } from "@hooma/media-processing";

export interface RequestImageProcessor {
  process(body: Uint8Array, contentType: RequestImageContentType): Promise<ProcessedMediaResult>;
}
