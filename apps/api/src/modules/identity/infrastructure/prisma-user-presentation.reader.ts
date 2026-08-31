import type { PrismaClient } from "@hooma/database";
import type {
  UserPresentationReader,
  UserPresentationSummary,
} from "../application/user-presentation.reader.js";

export class PrismaUserPresentationReader implements UserPresentationReader {
  constructor(private readonly db: PrismaClient) {}

  async findByUserIds(userIds: readonly string[]): Promise<readonly UserPresentationSummary[]> {
    if (!userIds.length) return [];

    return this.db.userPresentation.findMany({
      where: { userId: { in: [...new Set(userIds)] } },
      select: { userId: true, displayName: true, username: true, photoUrl: true },
    });
  }
}
