export interface WhistleTransientStore {
  putBody(whistleId: string, body: string, expiresInMilliseconds: number): Promise<void>;
  getBodies(whistleIds: readonly string[]): Promise<ReadonlyMap<string, string>>;
  deleteBody(whistleId: string): Promise<void>;
}
