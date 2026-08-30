export interface ExternalPlaceImageResolver {
  resolve(value: string): Promise<string>;
}

type PlaceImageFields = {
  readonly imageUrl?: string | null | undefined;
  readonly imageUrls?: string[] | undefined;
};

export async function resolvePlaceImageFields<T extends PlaceImageFields>(
  input: T,
  resolver: ExternalPlaceImageResolver,
): Promise<T> {
  const cache = new Map<string, Promise<string>>();
  const resolve = (value: string) => {
    const existing = cache.get(value);
    if (existing) return existing;
    const pending = resolver.resolve(value);
    cache.set(value, pending);
    return pending;
  };

  const imageUrl =
    typeof input.imageUrl === "string" ? await resolve(input.imageUrl) : input.imageUrl;
  const imageUrls = input.imageUrls
    ? await Promise.all(input.imageUrls.map(resolve))
    : input.imageUrls;

  return {
    ...input,
    ...(input.imageUrl !== undefined ? { imageUrl } : {}),
    ...(input.imageUrls !== undefined ? { imageUrls } : {}),
  };
}
