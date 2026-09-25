import type {
  GearUpProductImageContentType,
  GearUpProductImageSource,
  GearUpSettingsUpdateInput,
} from "@hooma/contracts/gear-up";

export interface GearUpProductImageRecord {
  readonly id: string;
  readonly productId: string;
  readonly source: GearUpProductImageSource;
  readonly objectKey: string | null;
  readonly externalUrl: string | null;
  readonly contentType: GearUpProductImageContentType | null;
  readonly sizeBytes: number | null;
  readonly sortOrder: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface GearUpSettingsRecord {
  readonly productImageLimit: number;
}

export interface GearUpProductMediaRepository {
  list(productId: string): Promise<readonly GearUpProductImageRecord[]>;
  get(productId: string, imageId: string): Promise<GearUpProductImageRecord | null>;
  getSettings(): Promise<GearUpSettingsRecord>;
  updateSettings(
    userId: string,
    input: GearUpSettingsUpdateInput,
  ): Promise<GearUpSettingsRecord>;
  addExternalUrl(productId: string, url: string): Promise<GearUpProductImageRecord>;
  prepareUpload(imageId: string, productId: string, objectKey: string): Promise<void>;
  addPreparedUpload(input: {
    readonly imageId: string;
    readonly productId: string;
    readonly objectKey: string;
    readonly contentType: GearUpProductImageContentType;
    readonly sizeBytes: number;
  }): Promise<GearUpProductImageRecord>;
  delete(productId: string, imageId: string): Promise<GearUpProductImageRecord | null>;
  reorder(
    productId: string,
    imageIds: readonly string[],
  ): Promise<readonly GearUpProductImageRecord[]>;
}
