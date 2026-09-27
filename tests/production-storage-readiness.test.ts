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

test("repository deployment contract documents and preflights object storage scope", () => {
  const envExample = readFileSync(".env.example", "utf8");
  const deployPreflight = readFileSync("scripts/deploy-preflight.mjs", "utf8");
  const storageKeys = [
    "OBJECT_STORAGE_ENDPOINT",
    "OBJECT_STORAGE_REGION",
    "OBJECT_STORAGE_BUCKET",
    "OBJECT_STORAGE_ACCESS_KEY_ID",
    "OBJECT_STORAGE_SECRET_ACCESS_KEY",
    "MEDIA_STORAGE_SCOPE",
    "OBJECT_STORAGE_URL_STYLE",
  ];

  for (const key of storageKeys) {
    assert.match(envExample, new RegExp(`^${key}=`, "m"));
    assert.match(deployPreflight, new RegExp(`"${key}"`));
  }
});

test("production storage readiness stays on the shared object storage authority", () => {
  const config = readFileSync("packages/config/src/index.ts", "utf8");
  const apiContainer = readFileSync("apps/api/src/bootstrap/container.ts", "utf8");
  const apiReadiness = readFileSync(
    "apps/api/src/modules/system/application/readiness.service.ts",
    "utf8",
  );
  const workerMain = readFileSync("apps/worker/src/main.ts", "utf8");
  const workerHealth = readFileSync("apps/worker/src/health/worker-health.ts", "utf8");
  const healthRoutes = readFileSync("apps/api/src/http/system/health.routes.ts", "utf8");

  assert.match(config, /loadObjectStorageConfig/);
  assert.match(config, /NODE_ENV/);
  assert.match(config, /required in production/);
  assert.match(apiContainer, /S3ObjectStorage/);
  assert.match(apiContainer, /objectStorageReadinessProbe/);
  assert.match(apiReadiness, /objectStorage/);
  assert.match(workerMain, /loadObjectStorageConfig/);
  assert.match(workerMain, /S3ObjectStorage/);
  assert.match(workerMain, /createWorkerHealthServer/);
  assert.match(workerHealth, /objectStorage/);
  assert.match(workerHealth, /\/health\/ready/);
  assert.doesNotMatch(healthRoutes, /health\/storage|storage\/ready/);
});
