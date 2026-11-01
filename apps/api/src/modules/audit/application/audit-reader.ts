import type { Prisma } from "@hooma/database";

export interface AuditRecord {
  readonly id: string;
  readonly actorUserId: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly createdAt: Date;
}

export interface AuditCursor {
  readonly createdAt: Date;
  readonly id: string;
}

export interface AuditPageQuery {
  readonly actorUserId?: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly cursor?: AuditCursor | null;
  readonly limit: number;
}

export interface AuditPage {
  readonly items: readonly AuditRecord[];
  readonly nextCursor: AuditCursor | null;
}

export interface AuditEntryExistsQuery {
  readonly actions: readonly string[];
  readonly entityType: string;
  readonly entityId: string;
  readonly createdAtGte?: Date;
}

export interface AuditReader {
  count(transaction?: Prisma.TransactionClient): Promise<number>;
  findPage(query: AuditPageQuery): Promise<AuditPage>;
  exists(query: AuditEntryExistsQuery): Promise<boolean>;
}
