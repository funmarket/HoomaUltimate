import type { PrismaClient } from "@hooma/database";
import type { RequestRequesterPresentation } from "@hooma/contracts/requests";
import type { RequestRequesterReader } from "../application/request.repository.js";

/**
 * Reads the canonical identity presentation for Request authors. This is a
 * read-only projection over the Identity-owned UserPresentation table: a
 * Request never persists a duplicate display name, handle or avatar.
 */
export class PrismaRequestRequesterReader implements RequestRequesterReader {
  constructor(private readonly db: PrismaClient) {}

  async findPresentations(
    userIds: readonly string[],
  ): Promise<readonly RequestRequesterPresentation[]> {
    const unique = [...new Set(userIds.filter((userId) => userId.length > 0))];
    if (unique.length === 0) return [];
    const rows = await this.db.userPresentation.findMany({
      where: { userId: { in: unique } },
      select: { userId: true, username: true, displayName: true, photoUrl: true },
    });
    return rows.map((row): RequestRequesterPresentation => ({
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      photoUrl: row.photoUrl,
    }));
  }
}
