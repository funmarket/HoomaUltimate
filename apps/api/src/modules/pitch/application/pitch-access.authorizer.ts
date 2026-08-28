export interface PitchAccessAuthorizer {
  isPlatformAdmin(userId: string): Promise<boolean>;
  requireCapability(userId: string, capability: "REVIEW_PITCH_APPLICATIONS"): Promise<void>;
}
