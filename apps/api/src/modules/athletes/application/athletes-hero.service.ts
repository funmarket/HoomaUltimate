import type { ObjectStorage, ObjectStorageReadUrlSigner } from "@hooma/storage";
import { AthletesError } from "../domain/athletes-error.js";

const ATHLETES_HERO_OBJECT_KEY = "athletesathletes-hero.webp.webp";
const ATHLETES_HERO_READ_URL_TTL_SECONDS = 5 * 60;

export interface AthletesHeroDelivery {
  readonly contentUrl: string;
  readonly expiresAt: string;
}

export class AthletesHeroService {
  constructor(private readonly storage: ObjectStorage | null) {}

  async delivery(): Promise<AthletesHeroDelivery> {
    if (!this.storage || !supportsReadUrlSigning(this.storage)) {
      throw new AthletesError(
        "ATHLETES_HERO_STORAGE_NOT_CONFIGURED",
        "Athletes hero storage is not configured",
      );
    }

    const issuedAt = Date.now();
    try {
      return {
        contentUrl: await this.storage.createReadUrl(
          ATHLETES_HERO_OBJECT_KEY,
          ATHLETES_HERO_READ_URL_TTL_SECONDS,
        ),
        expiresAt: new Date(issuedAt + ATHLETES_HERO_READ_URL_TTL_SECONDS * 1000).toISOString(),
      };
    } catch {
      throw new AthletesError("ATHLETES_HERO_UNAVAILABLE", "Athletes hero is unavailable");
    }
  }
}

function supportsReadUrlSigning(
  storage: ObjectStorage,
): storage is ObjectStorage & ObjectStorageReadUrlSigner {
  return "createReadUrl" in storage && typeof storage.createReadUrl === "function";
}
