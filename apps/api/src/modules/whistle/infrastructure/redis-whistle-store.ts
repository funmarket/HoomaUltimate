import { AppError } from "../../../http/errors/app-error.js";
import {
  getSharedRedisClient,
  RedisInfrastructureError,
  type RedisClient,
  type RedisValue,
} from "../../../infrastructure/redis/redis-client.js";
import type { WhistleTransientStore } from "../application/whistle.store.js";

function whistleRedisError(error: unknown): AppError {
  if (error instanceof RedisInfrastructureError) {
    if (error.code === "TIMEOUT") {
      return new AppError(
        503,
        "WHISTLE_REDIS_TIMEOUT",
        "Whistle transient store timed out",
      );
    }
    if (error.code === "PROTOCOL") {
      return new AppError(
        503,
        "WHISTLE_REDIS_PROTOCOL",
        "Whistle transient store returned an invalid response",
      );
    }
    if (error.code === "COMMAND") {
      return new AppError(
        503,
        "WHISTLE_REDIS_ERROR",
        "Whistle transient store rejected the request",
      );
    }
    if (error.code === "CONFIG") {
      return new AppError(
        503,
        "WHISTLE_REDIS_CONFIG",
        "Whistle requires a redis:// transient store",
      );
    }
  }
  return new AppError(
    503,
    "WHISTLE_REDIS_UNAVAILABLE",
    "Whistle transient store is unavailable",
  );
}

export class RedisWhistleStore implements WhistleTransientStore {
  private readonly redis: RedisClient;

  constructor(redisUrl: string) {
    try {
      this.redis = getSharedRedisClient(redisUrl);
    } catch (error) {
      throw whistleRedisError(error);
    }
  }

  private bodyKey(whistleId: string) {
    return `whistle:body:${whistleId}`;
  }

  private async command(parts: readonly string[]): Promise<RedisValue> {
    try {
      return await this.redis.command(parts);
    } catch (error) {
      throw whistleRedisError(error);
    }
  }

  async putBody(
    whistleId: string,
    body: string,
    expiresInMilliseconds: number,
  ): Promise<void> {
    const ttl = Math.max(1, Math.floor(expiresInMilliseconds));
    const result = await this.command([
      "SET",
      this.bodyKey(whistleId),
      body,
      "PX",
      String(ttl),
      "NX",
    ]);
    if (result !== "OK") {
      throw new AppError(
        503,
        "WHISTLE_BODY_STORE_FAILED",
        "Could not store Whistle body",
      );
    }
  }

  async getBodies(
    whistleIds: readonly string[],
  ): Promise<ReadonlyMap<string, string>> {
    if (whistleIds.length === 0) return new Map();

    const result = await this.command([
      "MGET",
      ...whistleIds.map((whistleId) => this.bodyKey(whistleId)),
    ]);
    if (!Array.isArray(result) || result.length !== whistleIds.length) {
      throw new AppError(
        503,
        "WHISTLE_REDIS_PROTOCOL",
        "Invalid Whistle body response",
      );
    }

    const bodies = new Map<string, string>();
    for (let index = 0; index < whistleIds.length; index += 1) {
      const body = result[index];
      if (body === null) continue;
      if (typeof body !== "string") {
        throw new AppError(
          503,
          "WHISTLE_REDIS_PROTOCOL",
          "Invalid Whistle body response",
        );
      }
      bodies.set(whistleIds[index]!, body);
    }
    return bodies;
  }

  async deleteBody(whistleId: string): Promise<void> {
    await this.command(["DEL", this.bodyKey(whistleId)]);
  }
}
