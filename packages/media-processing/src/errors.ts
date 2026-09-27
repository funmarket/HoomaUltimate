export type MediaProcessingErrorCode =
  | "EMPTY_INPUT"
  | "INPUT_TOO_LARGE"
  | "UNSUPPORTED_FORMAT"
  | "FORMAT_MISMATCH"
  | "PIXEL_LIMIT_EXCEEDED"
  | "INVALID_IMAGE"
  | "UNKNOWN_NAMESPACE"
  | "UNKNOWN_SCOPE"
  | "UNKNOWN_VARIANT"
  | "UNSAFE_IDENTIFIER"
  | "VARIANT_SET_MISMATCH";

export class MediaProcessingError extends Error {
  constructor(
    readonly code: MediaProcessingErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MediaProcessingError";
  }
}
