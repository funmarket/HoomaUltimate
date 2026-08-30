import assert from "node:assert/strict";
import test from "node:test";
import { loadObjectStorageConfig } from "@hooma/config";

test("object storage config loads without API-only production requirements", () => {
  const config = loadObjectStorageConfig({
    NODE_ENV: "production",
    OBJECT_STORAGE_ENDPOINT: "https://storage.example.com",
    OBJECT_STORAGE_REGION: "auto",
    OBJECT_STORAGE_BUCKET: "hooma-test",
    OBJECT_STORAGE_ACCESS_KEY_ID: "access-key",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret-key",
  });

  assert.equal(config.OBJECT_STORAGE_ENDPOINT, "https://storage.example.com");
  assert.equal(config.OBJECT_STORAGE_REGION, "auto");
});

test("object storage config still requires complete storage credentials", () => {
  assert.throws(
    () =>
      loadObjectStorageConfig({
        OBJECT_STORAGE_ENDPOINT: "https://storage.example.com",
      }),
    /Object storage configuration must be provided as a complete set/,
  );
});
