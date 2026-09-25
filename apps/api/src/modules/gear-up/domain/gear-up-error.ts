export type GearUpErrorCode =
  | "GEAR_UP_SHOP_NOT_FOUND"
  | "GEAR_UP_MANAGE_FORBIDDEN"
  | "GEAR_UP_REVIEW_NOT_PENDING"
  | "GEAR_UP_PRODUCT_NOT_FOUND"
  | "GEAR_UP_PRODUCT_MANAGE_FORBIDDEN";

export class GearUpError extends Error {
  override readonly name = "GearUpError";

  constructor(
    readonly code: GearUpErrorCode,
    message: string,
  ) {
    super(message);
  }
}
