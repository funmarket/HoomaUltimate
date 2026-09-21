import assert from "node:assert/strict";
import test from "node:test";

type RecordedCall = {
  readonly path: string;
  readonly method: string;
  readonly body: unknown;
};

function installFetchStub(calls: RecordedCall[], body: unknown = { items: [], nextCursor: null }) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({
      path: `${url.pathname}${url.search}`,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

const createInput = {
  publisher: {},
  audience: { scope: "PUBLIC" as const },
  category: "ITEM" as const,
  title: "Need size 43 running shoes",
  description: "Looking for used or new running shoes for training sessions.",
};

test("Requests API client uses the existing public and member endpoint families", async () => {
  const calls: RecordedCall[] = [];
  const restore = installFetchStub(calls);
  try {
    const { createRequestsApi } = await import("../packages/frontend/src/requests/api");
    const api = createRequestsApi({ baseUrl: "http://api.test" });

    await api.publicList({ limit: 30, category: "ITEM", city: "La Marsa" });
    await api.memberList();
    await api.create(createInput);
    await api.respond("request-1", { message: "I can help with a spare pair." });

    assert.deepEqual(calls, [
      {
        path: "/api/public/v1/requests?limit=30&category=ITEM&city=La+Marsa",
        method: "GET",
        body: null,
      },
      { path: "/api/v1/requests", method: "GET", body: null },
      { path: "/api/v1/requests", method: "POST", body: createInput },
      {
        path: "/api/v1/requests/request-1/responses",
        method: "POST",
        body: { message: "I can help with a spare pair." },
      },
    ]);
  } finally {
    restore();
  }
});

test("Requests API client keeps detail, response and lifecycle routes exact", async () => {
  const calls: RecordedCall[] = [];
  const restore = installFetchStub(calls, { items: [] });
  try {
    const { createRequestsApi } = await import("../packages/frontend/src/requests/api");
    const api = createRequestsApi({ baseUrl: "http://api.test" });

    await api.publicDetail("request-1");
    await api.memberDetail("request-1");
    await api.responses("request-1");
    await api.acceptResponse("request-1", "response-1");
    await api.declineResponse("request-1", "response-2");
    await api.withdrawResponse("request-1", "response-3");
    await api.fulfill("request-1");
    await api.cancel("request-1");

    assert.deepEqual(
      calls.map((call) => `${call.method} ${call.path}`),
      [
        "GET /api/public/v1/requests/request-1",
        "GET /api/v1/requests/request-1",
        "GET /api/v1/requests/request-1/responses",
        "POST /api/v1/requests/request-1/responses/response-1/accept",
        "POST /api/v1/requests/request-1/responses/response-2/decline",
        "POST /api/v1/requests/request-1/responses/response-3/withdraw",
        "POST /api/v1/requests/request-1/fulfill",
        "POST /api/v1/requests/request-1/cancel",
      ],
    );
  } finally {
    restore();
  }
});
