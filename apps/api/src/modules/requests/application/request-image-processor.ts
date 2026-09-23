import type { RequestImageContentType } from "@hooma/contracts/requests";

export interface ProcessedRequestImage {
  readonly body: Uint8Array;
  readonly contentType: RequestImageContentType;
}

export interface RequestImageProcessor {
  process(body: Uint8Array, contentType: RequestImageContentType): Promise<ProcessedRequestImage>;
}
