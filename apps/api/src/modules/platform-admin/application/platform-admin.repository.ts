export interface PlatformAdminOverview {
  readonly users: number;
  readonly activePlatformAdmins: number;
  readonly auditEntries: number;
}

export interface PlatformAdminAuditEntry {
  readonly id: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly createdAt: Date;
}

export interface PlatformAdminRepository {
  hasPlatformAdminRole(userId: string): Promise<boolean>;
  overview(): Promise<PlatformAdminOverview>;
  auditEntries(limit: number): Promise<readonly PlatformAdminAuditEntry[]>;
}
