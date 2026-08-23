export interface WhistleTransientStore {
  putBody(whistleId: string, body: string, expiresInMilliseconds: number): Promise<void>;
  getBody(whistleId: string): Promise<string | null>;
  deleteBody(whistleId: string): Promise<void>;
}
