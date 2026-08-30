export interface EventImageResolver {
  resolve(value: string): Promise<string>;
}
