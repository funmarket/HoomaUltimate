import sharp, { type Metadata } from "sharp";
import { MediaProcessingError } from "./errors.js";
import type {
  MediaInputContentType,
  MediaProcessingProfile,
  MediaVariant,
  PageBannerVariantSpec,
  PhotoVariantSpec,
} from "./profiles.js";

export interface ProcessMediaInput {
  readonly body: Uint8Array;
  readonly contentType: MediaInputContentType;
  readonly profile: MediaProcessingProfile;
  readonly maxInputBytes?: number;
}

export interface ProcessedMediaVariant {
  readonly variant: MediaVariant;
  readonly body: Uint8Array;
  readonly contentType: "image/webp";
  readonly sizeBytes: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface ProcessedMediaResult {
  readonly profile: MediaProcessingProfile["id"];
  readonly source: Readonly<{
    contentType: MediaInputContentType;
    widthPx: number;
    heightPx: number;
  }>;
  readonly variants: readonly ProcessedMediaVariant[];
}

const CONTENT_TYPE_BY_FORMAT = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

type SupportedSharpFormat = keyof typeof CONTENT_TYPE_BY_FORMAT;

function isSupportedContentType(value: string): value is MediaInputContentType {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

function isSupportedSharpFormat(value: string | undefined): value is SupportedSharpFormat {
  return value === "jpeg" || value === "png" || value === "webp";
}

function orientedDimensions(metadata: Metadata): { width: number; height: number } {
  const width = metadata.width;
  const height = metadata.height;
  if (!width || !height)
    throw new MediaProcessingError("INVALID_IMAGE", "Image dimensions are unavailable");
  if ([5, 6, 7, 8].includes(metadata.orientation ?? 1)) return { width: height, height: width };
  return { width, height };
}

function classifySharpFailure(error: unknown): MediaProcessingError {
  if (error instanceof MediaProcessingError) return error;
  const message = error instanceof Error ? error.message : String(error);
  if (/pixel limit|input image exceeds|too many pixels/i.test(message)) {
    return new MediaProcessingError(
      "PIXEL_LIMIT_EXCEEDED",
      "Image exceeds the decoded 40 megapixel limit",
      {
        cause: error,
      },
    );
  }
  return new MediaProcessingError("INVALID_IMAGE", "Image bytes could not be safely decoded", {
    cause: error,
  });
}

async function inspectInput(input: ProcessMediaInput): Promise<{
  metadata: Metadata;
  width: number;
  height: number;
}> {
  if (!input.body.byteLength) throw new MediaProcessingError("EMPTY_INPUT", "Image body is empty");
  if (!isSupportedContentType(input.contentType)) {
    throw new MediaProcessingError(
      "UNSUPPORTED_FORMAT",
      "Only JPEG, PNG and WebP inputs are supported",
    );
  }
  if (input.maxInputBytes !== undefined) {
    if (!Number.isInteger(input.maxInputBytes) || input.maxInputBytes <= 0) {
      throw new MediaProcessingError("INPUT_TOO_LARGE", "maxInputBytes must be a positive integer");
    }
    if (input.body.byteLength > input.maxInputBytes) {
      throw new MediaProcessingError(
        "INPUT_TOO_LARGE",
        "Image body exceeds the caller-provided byte limit",
      );
    }
  }

  try {
    const image = sharp(input.body, {
      failOn: "warning",
      limitInputPixels: input.profile.maxDecodedPixels,
    });
    const metadata = await image.metadata();
    if (!isSupportedSharpFormat(metadata.format)) {
      throw new MediaProcessingError("UNSUPPORTED_FORMAT", "Decoded image format is not supported");
    }
    if (CONTENT_TYPE_BY_FORMAT[metadata.format] !== input.contentType) {
      throw new MediaProcessingError(
        "FORMAT_MISMATCH",
        "Declared content type does not match decoded image format",
      );
    }
    const rawWidth = metadata.width;
    const rawHeight = metadata.height;
    if (!rawWidth || !rawHeight)
      throw new MediaProcessingError("INVALID_IMAGE", "Image dimensions are unavailable");
    if (rawWidth * rawHeight > input.profile.maxDecodedPixels) {
      throw new MediaProcessingError(
        "PIXEL_LIMIT_EXCEEDED",
        "Image exceeds the decoded 40 megapixel limit",
      );
    }
    await image.stats();
    const { width, height } = orientedDimensions(metadata);
    return { metadata, width, height };
  } catch (error) {
    throw classifySharpFailure(error);
  }
}

async function processPhotoVariant(
  body: Uint8Array,
  maxDecodedPixels: number,
  spec: PhotoVariantSpec,
): Promise<ProcessedMediaVariant> {
  try {
    const { data, info } = await sharp(body, {
      failOn: "warning",
      limitInputPixels: maxDecodedPixels,
    })
      .rotate()
      .resize({
        width: spec.maxEdgePx,
        height: spec.maxEdgePx,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: spec.quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (!data.byteLength || !info.width || !info.height) {
      throw new MediaProcessingError("INVALID_IMAGE", "Normalized image output is empty");
    }
    return {
      variant: spec.variant,
      body: new Uint8Array(data),
      contentType: "image/webp",
      sizeBytes: data.byteLength,
      widthPx: info.width,
      heightPx: info.height,
    };
  } catch (error) {
    throw classifySharpFailure(error);
  }
}

function bannerCanvasDimensions(spec: PageBannerVariantSpec): { width: number; height: number } {
  return { width: spec.maxWidthPx, height: spec.maxHeightPx };
}

async function processBannerVariant(
  body: Uint8Array,
  maxDecodedPixels: number,
  background: string,
  spec: PageBannerVariantSpec,
): Promise<ProcessedMediaVariant> {
  try {
    const canvas = bannerCanvasDimensions(spec);
    const artwork = await sharp(body, { failOn: "warning", limitInputPixels: maxDecodedPixels })
      .rotate()
      .resize({
        width: canvas.width,
        height: canvas.height,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();

    const { data, info } = await sharp({
      create: { width: canvas.width, height: canvas.height, channels: 3, background },
    })
      .composite([{ input: artwork, gravity: "center" }])
      .webp({ quality: spec.quality, effort: 4 })
      .toBuffer({ resolveWithObject: true });

    if (!data.byteLength || !info.width || !info.height) {
      throw new MediaProcessingError("INVALID_IMAGE", "Normalized banner output is empty");
    }
    return {
      variant: spec.variant,
      body: new Uint8Array(data),
      contentType: "image/webp",
      sizeBytes: data.byteLength,
      widthPx: info.width,
      heightPx: info.height,
    };
  } catch (error) {
    throw classifySharpFailure(error);
  }
}

export async function processMedia(input: ProcessMediaInput): Promise<ProcessedMediaResult> {
  const source = await inspectInput(input);
  const variants: ProcessedMediaVariant[] = [];
  if (input.profile.kind === "photo") {
    for (const spec of input.profile.variants) {
      variants.push(await processPhotoVariant(input.body, input.profile.maxDecodedPixels, spec));
    }
  } else {
    for (const spec of input.profile.variants) {
      variants.push(
        await processBannerVariant(
          input.body,
          input.profile.maxDecodedPixels,
          input.profile.background,
          spec,
        ),
      );
    }
  }
  return {
    profile: input.profile.id,
    source: { contentType: input.contentType, widthPx: source.width, heightPx: source.height },
    variants,
  };
}
