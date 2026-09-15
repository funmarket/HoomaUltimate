import { AppError } from "../errors/app-error.js";
import { RedisClientError, type RedisValue } from "../../infrastructure/redis/redis-client.js";
import {
  normalizeRateLimitOptions,
  type ApiRateLimiter,
  type ApiRateLimitPolicy,
  type ApiRateLimiterOptions,
  type ApiRateLimitDecision,
} from "./api-rate-limiter.js";

const CONSUME_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[2])
end
local ttl = redis.call("PTTL", KEYS[1])
if ttl < 0 then
  redis.call("PEXPIRE", KEYS[1], ARGV[2])
  ttl = tonumber(ARGV[2])
end
return { current, ttl }
`;

export interface RedisCommandClient {
  command(parts: readonly string[]): Promise<RedisValue>;
}

export class RedisApiRateLimiter implements ApiRateLimiter {
  private readonly options: ApiRateLimiterOptions;

  constructor(
    private readonly redis: RedisCommandClient,
    options: ApiRateLimiterOptions,
  ) {
    this.options = normalizeRateLimitOptions(options);
  }

  async consume(
    bucket: string,
    identifier: string,
    policy: ApiRateLimitPolicy = {},
  ): Promise<ApiRateLimitDecision> {
    const options = normalizeRateLimitOptions({
      ...this.options,
      ...(policy.limit === undefined ? {} : { limit: policy.limit }),
      ...(policy.windowSeconds === undefined ? {} : { windowSeconds: policy.windowSeconds }),
    });
    const key = this.key(bucket, identifier);
    const windowMilliseconds = options.windowSeconds * 1_000;
    let result: RedisValue;
    try {
      result = await this.redis.command([
        "EVAL",
        CONSUME_SCRIPT,
        "1",
        key,
        String(options.limit),
        String(windowMilliseconds),
      ]);
    } catch (error) {
      throw rateLimitRedisError(error);
    }

    if (!Array.isArray(result) || result.length !== 2) {
      throw new AppError(503, "API_RATE_LIMIT_REDIS_PROTOCOL", "API rate limit store failed");
    }
    const count = toNumber(result[0]!);
    const ttlMilliseconds = Math.max(1, toNumber(result[1]!));
    const retryAfterSeconds = Math.max(1, Math.ceil(ttlMilliseconds / 1_000));
    const remaining = Math.max(0, options.limit - count);
    return {
      allowed: count <= options.limit,
      limit: options.limit,
      remaining,
      retryAfterSeconds,
    };
  }

  private key(bucket: string, identifier: string): string {
    return `${this.options.keyPrefix}:${sanitize(bucket)}:${sanitize(identifier)}`;
  }
}

function toNumber(value: RedisValue): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AppError(503, "API_RATE_LIMIT_REDIS_PROTOCOL", "API rate limit store failed");
  }
  return value;
}

function sanitize(value: string): string {
  return value.replace(/[^A-Za-z0-9:._-]/g, "_").slice(0, 180) || "unknown";
}

function rateLimitRedisError(error: unknown): AppError {
  if (error instanceof RedisClientError) {
    if (error.kind === "TIMEOUT") {
      return new AppError(503, "API_RATE_LIMIT_REDIS_TIMEOUT", "API rate limit store timed out");
    }
    if (error.kind === "CONFIG") {
      return new AppError(
        503,
        "API_RATE_LIMIT_REDIS_CONFIG",
        "API rate limit store is misconfigured",
      );
    }
  }
  return new AppError(
    503,
    "API_RATE_LIMIT_REDIS_UNAVAILABLE",
    "API rate limit store is unavailable",
  );
}
