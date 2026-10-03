export interface GamerDirectWhistleContextResolver {
  resolveDirectWhistleContext(userId: string, otherProfileId: string): Promise<string>;
}
