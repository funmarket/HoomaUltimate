/**
 * Persistence package boundary.
 * Phase 1 introduces the fresh HOOMA ULTIMATE Prisma schema and initial migration here.
 */
export interface TransactionBoundary {
  run<T>(operation: () => Promise<T>): Promise<T>;
}
