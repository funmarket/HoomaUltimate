export interface PlatformAdminAuthorizer {
  isPlatformAdmin(userId: string): Promise<boolean>;
}
