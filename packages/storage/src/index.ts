export interface StoredObjectDescriptor {
  readonly key: string;
  readonly contentType: string;
  readonly sizeBytes: number;
}

export interface ObjectStorage {
  put(key: string, body: Uint8Array, contentType: string): Promise<StoredObjectDescriptor>;
  remove(key: string): Promise<void>;
}
