import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { loadApiConfig } from "@hooma/config";

test("API production config rejects missing object storage", () => {
  assert.throws(
    () =>
      loadApiConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/hooma_ultimate",
        REDIS_URL: "redis://localhost:6379",
        TELEGRAM_BOT_TOKEN: "production-token",
      }),
    /OBJECT_STORAGE_.*required in production/,
  );
});

test("production storage readiness stays on the shared object storage authority", () => {
  const config = readFileSync("packages/config/src/index.ts", "utf8");
  const apiContainer = readFileSync("apps/api/src/bootstrap/container.ts", "utf8");
  const workerMain = readFileSync("apps/worker/src/main.ts", "utf8");
  const healthRoutes = readFileSync("apps/api/src/http/system/health.routes.ts", "utf8");

  assert.match(config, /loadObjectStorageConfig/);
  assert.match(config, /NODE_ENV/);
  assert.match(config, /required in production/);
  assert.match(apiContainer, /S3ObjectStorage/);
  assert.match(workerMain, /loadObjectStorageConfig/);
  assert.match(workerMain, /S3ObjectStorage/);
  assert.doesNotMatch(healthRoutes, /health\/storage|storage\/ready/);
});
