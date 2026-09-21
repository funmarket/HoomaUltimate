import { PrismaClient } from "@prisma/client";

export { Prisma, PrismaClient, PlatformRole, OutboxStatus } from "@prisma/client";

let singleton: PrismaClient | undefined;

export function getDatabaseClient(): PrismaClient {
  singleton ??= new PrismaClient();
  return singleton;
}

export type HelpRequestExpiryDatabase = Pick<PrismaClient, "helpRequest">;

export async function expireDueHelpRequests(
  database: HelpRequestExpiryDatabase,
  now: Date,
): Promise<number> {
  const result = await database.helpRequest.updateMany({
    where: {
      status: { in: ["OPEN", "IN_PROGRESS"] },
      expiresAt: { not: null, lte: now },
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

export async function disconnectDatabase(): Promise<void> {
  if (!singleton) return;
  await singleton.$disconnect();
  singleton = undefined;
}
