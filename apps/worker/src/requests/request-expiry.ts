import { expireDueHelpRequests, type HelpRequestExpiryDatabase } from "@hooma/database";

export type RequestExpiryDatabase = HelpRequestExpiryDatabase;

export interface RequestExpiryResult {
  readonly expiredRequests: number;
}

export async function expireDueRequests(
  database: RequestExpiryDatabase,
  now: Date = new Date(),
): Promise<RequestExpiryResult> {
  return {
    expiredRequests: await expireDueHelpRequests(database, now),
  };
}
