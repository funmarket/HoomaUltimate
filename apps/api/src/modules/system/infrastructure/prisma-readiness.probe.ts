import type { PrismaClient } from "@hooma/database";
import type { ReadinessProbe } from "../application/readiness.service.js";

export class PrismaReadinessProbe implements ReadinessProbe {
  constructor(private readonly database: PrismaClient) {}

  async check(): Promise<void> {
    await this.database.$queryRaw`SELECT 1`;
  }
}
