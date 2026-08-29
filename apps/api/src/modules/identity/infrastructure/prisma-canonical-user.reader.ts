import type { PrismaClient } from "@hooma/database";
import { normalizeUsername } from "../domain/normalization.js";
import type { CanonicalUserReader } from "../application/canonical-user.reader.js";

export class PrismaCanonicalUserReader implements CanonicalUserReader {
  constructor(private readonly db: PrismaClient) {}

  async findUserIdByUsername(username: string): Promise<string | null> {
    const presentation = await this.db.userPresentation.findUnique({
      where: { username: normalizeUsername(username) },
      select: { userId: true },
    });
    return presentation?.userId ?? null;
  }
}
