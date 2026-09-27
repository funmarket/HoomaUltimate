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
    MEDIA_STORAGE_SCOPE: "production",
  });

  assert.equal(config.OBJECT_STORAGE_ENDPOINT, "https://storage.example.com");
  assert.equal(config.OBJECT_STORAGE_REGION, "auto");
  assert.equal(config.OBJECT_STORAGE_URL_STYLE, "path");
  assert.equal(config.MEDIA_STORAGE_SCOPE, "production");
});

test("object storage config rejects production without complete storage credentials", () => {
  assert.throws(
    () => loadObjectStorageConfig({ NODE_ENV: "production" }),
    /OBJECT_STORAGE_.*required in production/,
  );
});

test("object storage config still allows missing storage outside production", () => {
  const config = loadObjectStorageConfig({ NODE_ENV: "development" });

  assert.equal(config.OBJECT_STORAGE_ENDPOINT, undefined);
});

test("object storage config accepts explicit virtual URL style", () => {
  const config = loadObjectStorageConfig({
    OBJECT_STORAGE_ENDPOINT: "https://storage.example.com",
    OBJECT_STORAGE_REGION: "auto",
    OBJECT_STORAGE_BUCKET: "hooma-test",
    OBJECT_STORAGE_ACCESS_KEY_ID: "access-key",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret-key",
    MEDIA_STORAGE_SCOPE: "development",
    OBJECT_STORAGE_URL_STYLE: "virtual",
  });

  assert.equal(config.OBJECT_STORAGE_URL_STYLE, "virtual");
});

test("object storage config rejects invalid URL style", () => {
  assert.throws(
    () =>
      loadObjectStorageConfig({
        OBJECT_STORAGE_ENDPOINT: "https://storage.example.com",
        OBJECT_STORAGE_REGION: "auto",
        OBJECT_STORAGE_BUCKET: "hooma-test",
        OBJECT_STORAGE_ACCESS_KEY_ID: "access-key",
        OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret-key",
        OBJECT_STORAGE_URL_STYLE: "invalid",
      }),
    /OBJECT_STORAGE_URL_STYLE/,
  );
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

test("object storage scope is explicit and independent of NODE_ENV", () => {
  const config = loadObjectStorageConfig({
    NODE_ENV: "production",
    OBJECT_STORAGE_ENDPOINT: "https://storage.example.com",
    OBJECT_STORAGE_REGION: "auto",
    OBJECT_STORAGE_BUCKET: "hooma-test",
    OBJECT_STORAGE_ACCESS_KEY_ID: "access-key",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret-key",
    MEDIA_STORAGE_SCOPE: "staging",
  });

  assert.equal(config.MEDIA_STORAGE_SCOPE, "staging");
});

test("configured object storage requires MEDIA_STORAGE_SCOPE", () => {
  assert.throws(
    () =>
      loadObjectStorageConfig({
        NODE_ENV: "development",
        OBJECT_STORAGE_ENDPOINT: "https://storage.example.com",
        OBJECT_STORAGE_REGION: "auto",
        OBJECT_STORAGE_BUCKET: "hooma-test",
        OBJECT_STORAGE_ACCESS_KEY_ID: "access-key",
        OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret-key",
      }),
    /MEDIA_STORAGE_SCOPE is required/,
  );
});

test("object storage config rejects invalid MEDIA_STORAGE_SCOPE", () => {
  assert.throws(
    () =>
      loadObjectStorageConfig({
        NODE_ENV: "development",
        OBJECT_STORAGE_ENDPOINT: "https://storage.example.com",
        OBJECT_STORAGE_REGION: "auto",
        OBJECT_STORAGE_BUCKET: "hooma-test",
        OBJECT_STORAGE_ACCESS_KEY_ID: "access-key",
        OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret-key",
        MEDIA_STORAGE_SCOPE: "qa",
      }),
    /MEDIA_STORAGE_SCOPE/,
  );
});
