import assert from "node:assert/strict";
import test from "node:test";
import {
  closeSharedRedisClient,
  getSharedRedisClient,
  RedisInfrastructureError,
} from "../apps/api/src/infrastructure/redis/redis-client.js";

test("API Redis runtime reuses one client for the configured endpoint", () => {
  closeSharedRedisClient();
  try {
    const first = getSharedRedisClient("redis://127.0.0.1:6379/0");
    const second = getSharedRedisClient("redis://127.0.0.1:6379/0");
    assert.equal(second, first);

    assert.throws(
      () => getSharedRedisClient("redis://127.0.0.1:6380/0"),
      (error: unknown) =>
        error instanceof RedisInfrastructureError && error.code === "CONFIG",
    );
  } finally {
    closeSharedRedisClient();
  }
});
