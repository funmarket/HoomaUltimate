import type { PrismaClient } from "@hooma/database";
import type { GamerEligibilityRepository } from "../application/gamer-eligibility.repository.js";

export class PrismaGamerEligibilityRepository implements GamerEligibilityRepository {
  constructor(private readonly db: PrismaClient) {}

  async hasGamerIdentity(userId: string): Promise<boolean> {
    const user = await this.db.user.findFirst({
      where: { id: userId, identities: { has: "GAMER" } },
      select: { id: true },
    });
    return Boolean(user);
  }
}
