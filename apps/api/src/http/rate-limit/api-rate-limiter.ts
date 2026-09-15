export interface ApiRateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface ApiRateLimiter {
  consume(
    bucket: string,
    identifier: string,
    policy?: ApiRateLimitPolicy,
  ): Promise<ApiRateLimitDecision>;
}

export interface ApiRateLimitPolicy {
  readonly limit?: number;
  readonly windowSeconds?: number;
}

export interface ApiRateLimiterOptions {
  readonly keyPrefix: string;
  readonly limit: number;
  readonly windowSeconds: number;
}

export function normalizeRateLimitOptions(options: ApiRateLimiterOptions): ApiRateLimiterOptions {
  return {
    keyPrefix: options.keyPrefix.trim() || "hooma:api-rate-limit:v1",
    limit: Math.max(1, Math.trunc(options.limit)),
    windowSeconds: Math.max(1, Math.trunc(options.windowSeconds)),
  };
}
