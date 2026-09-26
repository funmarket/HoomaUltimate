export type PlaceMediaErrorCode =
  | "PLACE_NOT_FOUND"
  | "PLACE_IMAGE_NOT_FOUND"
  | "PLACE_IMAGE_REQUIRED"
  | "PLACE_IMAGE_TYPE_INVALID"
  | "PLACE_IMAGE_TOO_LARGE"
  | "PLACE_IMAGE_STORAGE_NOT_CONFIGURED"
  | "PLACE_IMAGE_MANAGE_FORBIDDEN"
  | "PLACE_IMAGE_LIMIT_REACHED"
  | "PLACE_IMAGE_ORDER_INVALID";

export class PlaceMediaError extends Error {
  override readonly name = "PlaceMediaError";

  constructor(
    readonly code: PlaceMediaErrorCode,
    message: string,
  ) {
    super(message);
  }
}
