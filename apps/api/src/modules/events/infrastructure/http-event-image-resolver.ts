import { AppError } from "../../../http/errors/app-error.js";
import {
  ExternalImageResolutionError,
  HttpExternalImageResolver,
  type ExternalImageFetcher,
  type ExternalImageHostLookup,
} from "../../../infrastructure/media/http-external-image-resolver.js";
import type { EventImageResolver } from "../application/event-image-resolver.js";

export class HttpEventImageResolver implements EventImageResolver {
  private readonly resolver: HttpExternalImageResolver;

  constructor(fetcher?: ExternalImageFetcher, hostLookup?: ExternalImageHostLookup) {
    this.resolver = new HttpExternalImageResolver(
      fetcher,
      hostLookup,
      "HOOMA-WatchImageResolver/1.0",
    );
  }

  async resolve(value: string): Promise<string> {
    try {
      return await this.resolver.resolve(value);
    } catch (error) {
      if (error instanceof ExternalImageResolutionError) {
        throw new AppError(
          422,
          "WATCH_IMAGE_URL_UNRESOLVABLE",
          error.message.replace(/^Image /, "Watch image "),
        );
      }
      throw error;
    }
  }
}
