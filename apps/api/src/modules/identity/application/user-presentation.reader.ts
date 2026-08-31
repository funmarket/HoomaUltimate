export interface UserPresentationSummary {
  readonly userId: string;
  readonly displayName: string;
  readonly username: string;
  readonly photoUrl: string | null;
}

export interface UserPresentationReader {
  findByUserIds(userIds: readonly string[]): Promise<readonly UserPresentationSummary[]>;
}
