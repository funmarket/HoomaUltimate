export interface CanonicalUserReader {
  findUserIdByUsername(username: string): Promise<string | null>;
}
