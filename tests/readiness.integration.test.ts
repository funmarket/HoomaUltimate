import assert from "node:assert/strict";
import test from "node:test";
import { getDatabaseClient } from "@hooma/database";
import { RedisClient } from "../apps/api/src/infrastructure/redis/redis-client.js";
import { ReadinessService } from "../apps/api/src/modules/system/application/readiness.service.js";
import { PrismaReadinessProbe } from "../apps/api/src/modules/system/infrastructure/prisma-readiness.probe.js";
import { RedisReadinessProbe } from "../apps/api/src/modules/system/infrastructure/redis-readiness.probe.js";

const redisUrl = process.env.REDIS_URL;
if (!process.env.DATABASE_URL || !redisUrl) {
  throw new Error(
    "DATABASE_URL and REDIS_URL are required for readiness integration tests",
  );
}

const database = getDatabaseClient();

test("readiness reports PostgreSQL and Redis available", async () => {
  const redis = new RedisClient(redisUrl);
  const readiness = new ReadinessService(
    new PrismaReadinessProbe(database),
    new RedisReadinessProbe(redis),
  );

  try {
    assert.deepEqual(await readiness.check(), {
      status: "ok",
      checks: { postgres: "ok", redis: "ok" },
    });
  } finally {
    redis.close();
  }
});

test("readiness reports a failed dependency without throwing details", async () => {
  const readiness = new ReadinessService(
    { check: async () => undefined },
    {
      check: async () => {
        throw new Error("secret internal dependency detail");
      },
    },
  );

  assert.deepEqual(await readiness.check(), {
    status: "not_ready",
    checks: { postgres: "ok", redis: "failed" },
  });
});
