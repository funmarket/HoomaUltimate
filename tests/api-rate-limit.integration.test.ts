import assert from "node:assert/strict";
import test from "node:test";
import { RedisClient } from "../apps/api/src/infrastructure/redis/redis-client.js";
import { RedisApiRateLimiter } from "../apps/api/src/http/rate-limit/redis-api-rate-limiter.js";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is required for API rate-limit integration tests");
}

test("API rate limits are shared across Redis-backed API instances", async () => {
  const prefix = `test:api-rate:${Date.now()}:${Math.floor(Math.random() * 1_000_000)}`;
  const redisA = new RedisClient(redisUrl);
  const redisB = new RedisClient(redisUrl);
  const limiterA = new RedisApiRateLimiter(redisA, {
    keyPrefix: prefix,
    limit: 1,
    windowSeconds: 60,
  });
  const limiterB = new RedisApiRateLimiter(redisB, {
    keyPrefix: prefix,
    limit: 1,
    windowSeconds: 60,
  });

  try {
    const first = await limiterA.consume("public", "203.0.113.20");
    const second = await limiterB.consume("public", "203.0.113.20");

    assert.equal(first.allowed, true);
    assert.equal(second.allowed, false);
    assert.equal(second.remaining, 0);
  } finally {
    await redisA.command(["DEL", `${prefix}:public:203.0.113.20`]);
    redisA.close();
    redisB.close();
  }
});
