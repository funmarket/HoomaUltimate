import assert from "node:assert/strict";
import test from "node:test";
import { createHoomaApi, type HoomaTransport } from "../packages/frontend/src/api.js";

type FetchCall = {
  input: RequestInfo | URL;
  init?: RequestInit;
};

test("Athletes Photo frontend API uses shared authenticated transport", async () => {
  const originalFetch = globalThis.fetch;
  const calls: FetchCall[] = [];
  const metadata = {
    id: "photo-1",
    athletesCommunityId: "athletes/community 1",
    contentType: "image/webp" as const,
    sizeBytes: 3,
    createdAt: "2026-09-05T12:00:00.000Z",
    updatedAt: "2026-09-05T12:00:00.000Z",
  };
  const responses = [
    Response.json([metadata]),
    Response.json(metadata, { status: 201 }),
    new Response(new Uint8Array([1, 2, 3]), {
      headers: { "content-type": "image/webp" },
    }),
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
  const api = createHoomaApi(transport);

  try {
    const listed = await api.athletes.listPhotos("athletes/community 1");
    assert.deepEqual(listed, [metadata]);

    const uploadBytes = new Uint8Array([9, 8, 7]);
    const uploadBody = new Blob([uploadBytes], { type: "image/webp" });
    const uploaded = await api.athletes.uploadPhoto(
      "athletes/community 1",
      uploadBody,
      "image/webp",
    );
    assert.deepEqual(uploaded, metadata);

    const content = await api.athletes.fetchPhotoContent("athletes/community 1", "photo/1");
    assert.equal(content.type, "image/webp");
    assert.deepEqual(Array.from(new Uint8Array(await content.arrayBuffer())), [1, 2, 3]);

    assert.equal(calls.length, 3);
    assert.equal(
      calls[0]?.input,
      "https://api.example.test/api/v1/athletes/athletes%2Fcommunity%201/photos",
    );
    assert.equal(
      calls[1]?.input,
      "https://api.example.test/api/v1/athletes/athletes%2Fcommunity%201/photos",
    );
    assert.equal(
      calls[2]?.input,
      "https://api.example.test/api/v1/athletes/athletes%2Fcommunity%201/photos/photo%2F1/content",
    );

    for (const call of calls) {
      const headers = new Headers(call.init?.headers);
      assert.equal(call.init?.credentials, "include");
      assert.equal(headers.get("authorization"), "tma signed-init-data");
    }

    const listHeaders = new Headers(calls[0]?.init?.headers);
    const uploadHeaders = new Headers(calls[1]?.init?.headers);
    const contentHeaders = new Headers(calls[2]?.init?.headers);

    assert.equal(listHeaders.get("content-type"), "application/json");
    assert.equal(calls[1]?.init?.method, "POST");
    assert.equal(calls[1]?.init?.body, uploadBody);
    assert.equal(uploadHeaders.get("content-type"), "image/webp");
    assert.equal(contentHeaders.has("content-type"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
