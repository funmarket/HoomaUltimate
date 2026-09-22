/**
 * Proves that uploaded Request image bytes are actually a decodable image of
 * the declared type. Declared MIME type and byte length are not evidence: a
 * spoofed content-type or a truncated file must be rejected before the bytes
 * reach the canonical object storage.
 */
export interface RequestImageValidator {
  validate(body: Uint8Array, contentType: string): Promise<void>;
}
