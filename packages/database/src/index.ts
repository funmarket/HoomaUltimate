import { PrismaClient } from "@prisma/client";

export { Prisma, PrismaClient, PlatformRole, OutboxStatus } from "@prisma/client";

let singleton: PrismaClient | undefined;

export function getDatabaseClient(): PrismaClient {
  singleton ??= new PrismaClient();
  return singleton;
}

export async function disconnectDatabase(): Promise<void> {
  if (!singleton) return;
  await singleton.$disconnect();
  singleton = undefined;
}
