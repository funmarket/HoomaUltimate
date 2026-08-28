import type { PlatformManagerCapability } from "@hooma/contracts/platform-admin";

export interface PlatformAdminOverview {
  readonly users: number;
  readonly activePlatformAdmins: number;
  readonly activeAppManagers: number;
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

export interface AppManagerRecord {
  readonly userId: string;
  readonly username: string;
  readonly displayName: string;
  readonly capabilities: readonly PlatformManagerCapability[];
}

export interface PlatformAdminRepository {
  hasPlatformAdminRole(userId: string): Promise<boolean>;
  managerCapabilities(userId: string): Promise<readonly PlatformManagerCapability[]>;
  findUserByTelegramId(telegramUserId: bigint): Promise<string | null>;
  findUserByUsername(username: string): Promise<string | null>;
  reconcilePlatformOwner(userId: string): Promise<void>;
  listManagers(): Promise<readonly AppManagerRecord[]>;
  setManagerCapabilities(
    actorUserId: string,
    targetUserId: string,
    capabilities: readonly PlatformManagerCapability[],
  ): Promise<void>;
  overview(): Promise<PlatformAdminOverview>;
  auditEntries(limit: number): Promise<readonly PlatformAdminAuditEntry[]>;
}
