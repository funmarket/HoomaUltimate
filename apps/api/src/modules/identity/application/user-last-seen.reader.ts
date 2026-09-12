export interface UserLastSeenReader {
  findLastSeenByUserIds(userIds: readonly string[]): Promise<Map<string, Date | null>>;
}
