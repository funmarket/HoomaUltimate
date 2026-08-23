export type WhistleRevealResult =
  | { state: "visible"; body: string; remainingMilliseconds: number }
  | { state: "expired" | "missing" };

export interface WhistleTransientStore {
  putBody(whistleId: string, body: string): Promise<void>;
  deleteBody(whistleId: string): Promise<void>;
  reveal(whistleId: string, viewerUserId: string): Promise<WhistleRevealResult>;
}
