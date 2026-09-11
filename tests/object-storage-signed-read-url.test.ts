import assert from "node:assert/strict";
import test from "node:test";
import { S3ObjectStorage, type S3ObjectStorageConfig } from "@hooma/storage";

const baseConfig = {
  endpoint: "https://storage.example.com",
  region: "auto",
  bucket: "hooma-test",
  accessKeyId: "access-key",
  secretAccessKey: "secret-key",
} satisfies S3ObjectStorageConfig;

function assertSignedReadUrl(value: string, expectedHost: string, expectedPath: string): void {
  const url = new URL(value);
  assert.equal(url.host, expectedHost);
  assert.equal(url.pathname, expectedPath);
  assert.equal(url.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.match(
    url.searchParams.get("X-Amz-Credential") ?? "",
    /^access-key\/\d{8}\/auto\/s3\/aws4_request$/,
  );
  assert.match(url.searchParams.get("X-Amz-Date") ?? "", /^\d{8}T\d{6}Z$/);
  assert.equal(url.searchParams.get("X-Amz-Expires"), "300");
  assert.equal(url.searchParams.get("X-Amz-SignedHeaders"), "host");
  assert.match(url.searchParams.get("X-Amz-Signature") ?? "", /^[a-f0-9]{64}$/);
  assert.equal(url.searchParams.has("X-Amz-Security-Token"), false);
  assert.equal(value.includes("secret-key"), false);
}

test("S3ObjectStorage creates path-style short-lived signed GET URLs without fetching bytes", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("signed URL generation must not fetch object bytes");
  };

  try {
    const storage = new S3ObjectStorage(baseConfig);
    const url = await storage.createReadUrl("athletes/example/photo one.webp", 300);

    assertSignedReadUrl(
      url,
      "storage.example.com",
      "/hooma-test/athletes/example/photo%20one.webp",
    );
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("S3ObjectStorage creates virtual-hosted signed GET URLs", async () => {
  const storage = new S3ObjectStorage({
    ...baseConfig,
    endpoint: "https://storage.example.com:9443",
    urlStyle: "virtual",
  });
  const url = await storage.createReadUrl("athletes/example/photo.webp", 300);

  assertSignedReadUrl(url, "hooma-test.storage.example.com:9443", "/athletes/example/photo.webp");
});

test("S3ObjectStorage bounds signed read URL lifetime", async () => {
  const storage = new S3ObjectStorage(baseConfig);

  await assert.rejects(() => storage.createReadUrl("photo.webp", 0), /between 1 and 3600 seconds/);
  await assert.rejects(
    () => storage.createReadUrl("photo.webp", 3601),
    /between 1 and 3600 seconds/,
  );
  await assert.rejects(
    () => storage.createReadUrl("photo.webp", 1.5),
    /between 1 and 3600 seconds/,
  );
});
