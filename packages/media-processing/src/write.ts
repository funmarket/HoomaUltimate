import type { ObjectStorage } from "@hooma/storage";
import { MediaProcessingError } from "./errors.js";
import { planMediaObjectKeys, type MediaIdentity } from "./keys.js";
import { profileFromId, type MediaVariant } from "./profiles.js";
import type { ProcessedMediaResult } from "./process.js";

export interface MediaVariantDescriptor extends MediaIdentity {
  readonly variant: MediaVariant;
  readonly objectKey: string;
  readonly contentType: "image/webp";
  readonly sizeBytes: number;
  readonly widthPx: number;
  readonly heightPx: number;
}

export interface MediaWriteResult {
  readonly descriptors: readonly MediaVariantDescriptor[];
  readonly cleanupKeys: readonly string[];
}

export class MediaVariantWriteError extends Error {
  readonly cleanupKeys: readonly string[];

  constructor(
    readonly failedVariant: MediaVariant,
    readonly plannedKeys: readonly string[],
    readonly writtenDescriptors: readonly MediaVariantDescriptor[],
    options?: ErrorOptions,
  ) {
    super(`Failed to write media variant: ${failedVariant}`, options);
    this.name = "MediaVariantWriteError";
    this.cleanupKeys = writtenDescriptors.map(({ objectKey }) => objectKey);
  }
}

export interface WriteMediaVariantsInput {
  readonly storage: ObjectStorage;
  readonly identity: MediaIdentity;
  readonly processed: ProcessedMediaResult;
}

export async function writeMediaVariants(
  input: WriteMediaVariantsInput,
): Promise<MediaWriteResult> {
  const profile = profileFromId(input.processed.profile);
  const plan = planMediaObjectKeys({ ...input.identity, profile });
  const plannedKeys = plan.map(({ objectKey }) => objectKey);
  const writtenDescriptors: MediaVariantDescriptor[] = [];

  for (const planned of plan) {
    const processedVariant = input.processed.variants.find(
      ({ variant }) => variant === planned.variant,
    );
    if (!processedVariant) {
      throw new MediaProcessingError(
        "VARIANT_SET_MISMATCH",
        `Processed media is missing planned variant ${planned.variant}`,
      );
    }
    try {
      await input.storage.put(
        planned.objectKey,
        processedVariant.body,
        processedVariant.contentType,
      );
      writtenDescriptors.push({
        ...input.identity,
        variant: processedVariant.variant,
        objectKey: planned.objectKey,
        contentType: processedVariant.contentType,
        sizeBytes: processedVariant.sizeBytes,
        widthPx: processedVariant.widthPx,
        heightPx: processedVariant.heightPx,
      });
    } catch (error) {
      throw new MediaVariantWriteError(planned.variant, plannedKeys, writtenDescriptors, {
        cause: error,
      });
    }
  }

  return {
    descriptors: writtenDescriptors,
    cleanupKeys: writtenDescriptors.map(({ objectKey }) => objectKey),
  };
}
