export interface AuditEntryInput {
  readonly actorUserId?: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string | null;
  readonly requestId?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface AuditWriter {
  write(entry: AuditEntryInput): Promise<void>;
}
