import assert from "node:assert/strict";
import test from "node:test";
import {
  HoomaApiError,
  request,
  requestBinary,
  requestBlob,
  type HoomaTransport,
} from "../packages/frontend/src/http.js";

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

test("shared transport handles JSON and binary responses", async () => {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];
  const errorBody = {
    error: {
      code: "AUTH_REQUIRED",
      message: "Authentication required",
    },
  };
  const responses = [
    Response.json({ ok: true }),
    Response.json({ id: "photo-1" }, { status: 201 }),
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image/png" },
    }),
    Response.json(errorBody, { status: 401 }),
  ];

  globalThis.fetch = async (input, init) => {
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
    const json = await request<{ ok: true }>(transport, "/json");
    assert.deepEqual(json, { ok: true });

    const bytes = new Uint8Array([9, 8, 7]);
    const binaryBody = new Blob([bytes], { type: "image/webp" });
    const uploaded = await requestBinary<{ id: string }>(
      transport,
      "/binary",
      binaryBody,
      "image/webp",
      { method: "POST" },
    );
    assert.deepEqual(uploaded, { id: "photo-1" });

    const downloaded = await requestBlob(transport, "/blob");
    const downloadedBytes = await downloaded.arrayBuffer();
    assert.equal(downloaded.type, "image/png");
    assert.deepEqual(Array.from(new Uint8Array(downloadedBytes)), [1, 2, 3]);

    await assert.rejects(requestBlob(transport, "/private-blob"), (error: unknown) => {
      assert.ok(error instanceof HoomaApiError);
      assert.equal(error.status, 401);
      assert.equal(error.code, "AUTH_REQUIRED");
      assert.equal(error.message, "Authentication required");
      return true;
    });

    assert.equal(calls.length, 4);
    for (const call of calls) {
      const headers = new Headers(call.init?.headers);
      assert.equal(call.init?.credentials, "include");
      assert.equal(headers.get("authorization"), "tma signed-init-data");
    }

    const jsonHeaders = new Headers(calls[0]?.init?.headers);
    const uploadHeaders = new Headers(calls[1]?.init?.headers);
    const blobHeaders = new Headers(calls[2]?.init?.headers);
    const errorHeaders = new Headers(calls[3]?.init?.headers);

    assert.equal(jsonHeaders.get("content-type"), "application/json");
    assert.equal(calls[1]?.init?.body, binaryBody);
    assert.equal(uploadHeaders.get("content-type"), "image/webp");
    assert.equal(blobHeaders.has("content-type"), false);
    assert.equal(errorHeaders.has("content-type"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
