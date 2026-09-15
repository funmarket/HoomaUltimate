import assert from "node:assert/strict";
import test from "node:test";
import { ReadinessService } from "../apps/api/src/modules/system/application/readiness.service.js";

test("API readiness includes object storage when configured", async () => {
  const readiness = new ReadinessService(
    { check: async () => undefined },
    { check: async () => undefined },
    { check: async () => undefined },
  );

  assert.deepEqual(await readiness.check(), {
    status: "ok",
    checks: { postgres: "ok", redis: "ok", objectStorage: "ok" },
  });
});

test("API readiness fails when configured object storage is unhealthy", async () => {
  const readiness = new ReadinessService(
    { check: async () => undefined },
    { check: async () => undefined },
    {
      check: async () => {
        throw new Error("storage unavailable");
      },
    },
  );

  assert.deepEqual(await readiness.check(), {
    status: "not_ready",
    checks: { postgres: "ok", redis: "ok", objectStorage: "failed" },
  });
});

test("API readiness marks object storage not configured only when no storage probe exists", async () => {
  const readiness = new ReadinessService(
    { check: async () => undefined },
    { check: async () => undefined },
  );

  assert.deepEqual(await readiness.check(), {
    status: "ok",
    checks: { postgres: "ok", redis: "ok", objectStorage: "not_configured" },
  });
});
