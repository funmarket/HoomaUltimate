export interface AuditEntryInput {
  readonly actorUserId?: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly requestId?: string | null;
  readonly metadata?: Record<string, unknown>;
}

import type { Prisma } from "@hooma/database";

export interface AuditWriter {
  write(entry: AuditEntryInput): Promise<void>;
  writeInTransaction(entry: AuditEntryInput, transaction: Prisma.TransactionClient): Promise<void>;
}
