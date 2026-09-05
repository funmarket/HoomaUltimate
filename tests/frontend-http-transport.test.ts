import assert from "node:assert/strict";
import test from "node:test";
import {
  HoomaApiError,
  request,
  requestBinary,
  requestBlob,
  type HoomaTransport,
} from "../packages/frontend/src/http.js";

test("shared frontend transport preserves JSON, auth, binary, blob, and API error behavior", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const responses = [
    new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
    new Response(JSON.stringify({ id: "photo-1" }), {
      status: 201,
      headers: { "content-type": "application/json" },
    }),
    new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png" },
    }),
    new Response(
      JSON.stringify({ error: { code: "AUTH_REQUIRED", message: "Authentication required" } }),
      {
        status: 401,
        headers: { "content-type": "application/json" },
      },
    ),
  ];

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    const response = responses.shift();
    if (!response) throw new Error("Unexpected fetch call");
    return response;
  };

  const transport: HoomaTransport = {
    baseUrl: "https://api.example.test",
    credentials: "include",
    getHeaders: () => ({ authorization: "tma signed-init-data" }),
  };

  try {
    assert.deepEqual(await request<{ ok: true }>(transport, "/json"), { ok: true });

    const binaryBody = new Blob([new Uint8Array([9, 8, 7])], { type: "image/webp" });
    assert.deepEqual(
      await requestBinary<{ id: string }>(
        transport,
        "/binary",
        binaryBody,
        "image/webp",
        { method: "POST" },
      ),
      { id: "photo-1" },
    );

    const downloaded = await requestBlob(transport, "/blob");
    assert.equal(downloaded.type, "image/png");
    assert.deepEqual(Array.from(new Uint8Array(await downloaded.arrayBuffer())), [1, 2, 3]);

    await assert.rejects(
      () => requestBlob(transport, "/private-blob"),
      (error: unknown) => {
        assert.ok(error instanceof HoomaApiError);
        assert.equal(error.status, 401);
        assert.equal(error.code, "AUTH_REQUIRED");
        assert.equal(error.message, "Authentication required");
        return true;
      },
    );

    assert.equal(calls.length, 4);
    for (const call of calls) {
      assert.equal(call.init?.credentials, "include");
      assert.equal(new Headers(call.init?.headers).get("authorization"), "tma signed-init-data");
    }

    assert.equal(new Headers(calls[0]?.init?.headers).get("content-type"), "application/json");
    assert.equal(calls[1]?.init?.body, binaryBody);
    assert.equal(new Headers(calls[1]?.init?.headers).get("content-type"), "image/webp");
    assert.equal(new Headers(calls[2]?.init?.headers).has("content-type"), false);
    assert.equal(new Headers(calls[3]?.init?.headers).has("content-type"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
