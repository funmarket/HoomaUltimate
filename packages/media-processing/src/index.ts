export { MediaProcessingError } from "./errors.js";
export type { MediaProcessingErrorCode } from "./errors.js";
export { MEDIA_NAMESPACES, buildMediaObjectKey, planMediaObjectKeys } from "./keys.js";
export type {
  MediaIdentity,
  MediaNamespace,
  MediaObjectKeyInput,
  MediaStorageScope,
  PlannedMediaObject,
} from "./keys.js";
export {
  ACCEPTED_MEDIA_CONTENT_TYPES,
  DEFAULT_INTENDED_HTTP_MAX_BYTES,
  MAX_DECODED_PIXELS,
  PAGE_BANNER_STANDARD,
  PHOTO_STANDARD,
} from "./profiles.js";
export type {
  MediaInputContentType,
  MediaProcessingProfile,
  MediaVariant,
  PageBannerStandardProfile,
  PageBannerVariant,
  PhotoStandardProfile,
  PhotoVariant,
} from "./profiles.js";
export { processMedia } from "./process.js";
export type { ProcessedMediaResult, ProcessedMediaVariant, ProcessMediaInput } from "./process.js";
export { MediaVariantWriteError, writeMediaVariants } from "./write.js";
export type { MediaVariantDescriptor, MediaWriteResult, WriteMediaVariantsInput } from "./write.js";
