import assert from "node:assert/strict";
import test from "node:test";
import { S3ObjectStorage, type S3ObjectStorageConfig } from "@hooma/storage";

type CapturedRequest = {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
};

const baseConfig = {
  endpoint: "https://storage.example.com",
  region: "auto",
  bucket: "hooma-test",
  accessKeyId: "access-key",
  secretAccessKey: "secret-key",
} satisfies S3ObjectStorageConfig;

async function withCapturedFetch(run: (calls: CapturedRequest[]) => Promise<void>): Promise<void> {
  const originalFetch = globalThis.fetch;
  const calls: CapturedRequest[] = [];

  globalThis.fetch = async (input, init) => {
    calls.push({
      url: input instanceof Request ? input.url : String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
    });

    return new Response(new Uint8Array([7, 8, 9]), {
      status: 200,
      headers: { "content-type": "image/jpeg" },
    });
  };

  try {
    await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function assertSignedHost(call: CapturedRequest, expectedHost: string): void {
  assert.equal(call.headers.get("host"), expectedHost);
  assert.match(call.headers.get("authorization") ?? "", /SignedHeaders=.*host/);
}

test(
  "S3ObjectStorage preserves path-style addressing by default for PUT, GET and DELETE",
  async () => {
    await withCapturedFetch(async (calls) => {
      const storage = new S3ObjectStorage(baseConfig);
      const key = "athletes/example/photo.jpg";

      await storage.put(key, new Uint8Array([1, 2, 3]), "image/jpeg");
      const stored = await storage.get(key);
      await storage.remove(key);

      assert.equal(calls.length, 3);
      assert.deepEqual(calls.map((call) => call.method), ["PUT", "GET", "DELETE"]);

      for (const call of calls) {
        assert.equal(
          call.url,
          "https://storage.example.com/hooma-test/athletes/example/photo.jpg",
        );
        assert.equal(new URL(call.url).pathname, "/hooma-test/athletes/example/photo.jpg");
        assertSignedHost(call, "storage.example.com");
      }

      assert.deepEqual(stored.body, new Uint8Array([7, 8, 9]));
      assert.equal(stored.contentType, "image/jpeg");
      assert.equal(stored.sizeBytes, 3);
    });
  },
);

test("S3ObjectStorage uses virtual-hosted addressing for PUT, GET and DELETE", async () => {
  await withCapturedFetch(async (calls) => {
    const storage = new S3ObjectStorage({
      ...baseConfig,
      endpoint: "https://storage.example.com:9443",
      urlStyle: "virtual",
    });
    const key = "athletes/example/photo.jpg";

    await storage.put(key, new Uint8Array([1, 2, 3]), "image/jpeg");
    const stored = await storage.get(key);
    await storage.remove(key);

    assert.equal(calls.length, 3);
    assert.deepEqual(calls.map((call) => call.method), ["PUT", "GET", "DELETE"]);

    for (const call of calls) {
      assert.equal(
        call.url,
        "https://hooma-test.storage.example.com:9443/athletes/example/photo.jpg",
      );
      assert.equal(new URL(call.url).pathname, "/athletes/example/photo.jpg");
      assert.equal(new URL(call.url).pathname.includes("hooma-test"), false);
      assertSignedHost(call, "hooma-test.storage.example.com:9443");
    }

    assert.deepEqual(stored.body, new Uint8Array([7, 8, 9]));
    assert.equal(stored.contentType, "image/jpeg");
    assert.equal(stored.sizeBytes, 3);
  });
});
