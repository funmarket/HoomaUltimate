import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Request, Response } from "express";
import { createApiRateLimitMiddleware } from "../apps/api/src/http/rate-limit/api-rate-limit.middleware.js";
import { RedisApiRateLimiter } from "../apps/api/src/http/rate-limit/redis-api-rate-limiter.js";
import type { RedisValue } from "../apps/api/src/infrastructure/redis/redis-client.js";

class FakeRedis {
  readonly commands: readonly string[][] = [];
  private count = 0;

  constructor(private readonly ttlMs = 30_000) {}

  async command(parts: readonly string[]): Promise<RedisValue> {
    (this.commands as string[][]).push([...parts]);
    this.count += 1;
    return [this.count, this.ttlMs];
  }
}

function createResponse() {
  return {
    statusCode: 200,
    headers: new Map<string, string>(),
    payload: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers.set(name, value);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

test("Redis API rate limiter uses one atomic Redis script instead of process-local state", async () => {
  const redis = new FakeRedis();
  const limiter = new RedisApiRateLimiter(redis, {
    keyPrefix: "test-api-rate",
    limit: 2,
    windowSeconds: 60,
  });

  assert.deepEqual(await limiter.consume("member", "user-1"), {
    allowed: true,
    limit: 2,
    remaining: 1,
    retryAfterSeconds: 30,
  });
  assert.deepEqual(await limiter.consume("member", "user-1"), {
    allowed: true,
    limit: 2,
    remaining: 0,
    retryAfterSeconds: 30,
  });
  assert.deepEqual(await limiter.consume("member", "user-1"), {
    allowed: false,
    limit: 2,
    remaining: 0,
    retryAfterSeconds: 30,
  });

  assert.equal(redis.commands.length, 3);
  assert.equal(redis.commands[0]?.[0], "EVAL");
  assert.match(redis.commands[0]?.[2] ?? "", /^1$/);
  assert.equal(redis.commands[0]?.[3], "test-api-rate:member:user-1");
});

test("API rate-limit middleware returns 429 with Retry-After after the shared limit", async () => {
  const redis = new FakeRedis(15_000);
  const limiter = new RedisApiRateLimiter(redis, {
    keyPrefix: "test-api-rate",
    limit: 1,
    windowSeconds: 60,
  });
  const middleware = createApiRateLimitMiddleware(limiter, "public");
  const request = {
    ip: "203.0.113.10",
    socket: { remoteAddress: "203.0.113.10" },
  } as Request;
  const firstResponse = createResponse();
  let firstNextCalls = 0;
  await middleware(request, firstResponse as unknown as Response, () => {
    firstNextCalls += 1;
  });
  assert.equal(firstNextCalls, 1);

  const secondResponse = createResponse();
  let secondNextCalls = 0;
  await middleware(request, secondResponse as unknown as Response, () => {
    secondNextCalls += 1;
  });

  assert.equal(secondNextCalls, 0);
  assert.equal(secondResponse.statusCode, 429);
  assert.equal(secondResponse.headers.get("Retry-After"), "15");
  assert.deepEqual(secondResponse.payload, {
    error: { code: "API_RATE_LIMITED", message: "Too many requests" },
  });
});

test("API rate-limit middleware prefers Express trusted proxy client IP", async () => {
  const seen: Array<{ bucket: string; identifier: string }> = [];
  const middleware = createApiRateLimitMiddleware(
    {
      async consume(bucket, identifier) {
        seen.push({ bucket, identifier });
        return { allowed: true, limit: 10, remaining: 9, retryAfterSeconds: 60 };
      },
    },
    "public",
  );
  const request = {
    ips: ["198.51.100.42", "10.0.0.10"],
    ip: "10.0.0.10",
    socket: { remoteAddress: "10.0.0.10" },
  } as unknown as Request;
  const response = createResponse();

  await middleware(request, response as unknown as Response, () => undefined);

  assert.deepEqual(seen, [{ bucket: "public", identifier: "198.51.100.42" }]);
});

test("API rate limiting remains Redis-backed and does not add PostgreSQL or Map authority", () => {
  const container = readFileSync("apps/api/src/bootstrap/container.ts", "utf8");
  const app = readFileSync("apps/api/src/bootstrap/app.ts", "utf8");
  const prismaSchema = readFileSync("packages/database/prisma/schema.prisma", "utf8");

  assert.match(container, /RedisApiRateLimiter/);
  assert.match(app, /createApiRateLimitMiddleware/);
  assert.match(app, /trust proxy/);
  assert.doesNotMatch(prismaSchema, /RateLimit|ApiRateLimit|LoginAttempt/);
  assert.doesNotMatch(container, /new Map<.*rate/i);
});
