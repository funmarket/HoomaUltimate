import { AppError } from "../../../http/errors/app-error.js";
import {
  ExternalImageResolutionError,
  HttpExternalImageResolver,
  type ExternalImageFetcher,
  type ExternalImageHostLookup,
} from "../../../infrastructure/media/http-external-image-resolver.js";
import type { ExternalPlaceImageResolver } from "../application/external-place-image-resolver.js";
import { normalizeExternalPlaceImageUrl } from "../boundary/external-place-image-url.js";

export class HttpExternalPlaceImageResolver implements ExternalPlaceImageResolver {
  private readonly resolver: HttpExternalImageResolver;

  constructor(fetcher?: ExternalImageFetcher, hostLookup?: ExternalImageHostLookup) {
    this.resolver = new HttpExternalImageResolver(fetcher, hostLookup, "HOOMA-PlaceImageResolver/2.0");
  }

  async resolve(value: string): Promise<string> {
    try {
      return await this.resolver.resolve(normalizeExternalPlaceImageUrl(value));
    } catch (error) {
      if (error instanceof ExternalImageResolutionError) {
        throw new AppError(422, "PLACE_IMAGE_URL_UNRESOLVABLE", error.message.replace(/^Image /, "Place photo "));
      }
      throw error;
    }
  }
}
