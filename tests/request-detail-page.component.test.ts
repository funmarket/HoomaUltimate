import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/requests/request-1",
  });
  const globals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Event: dom.window.Event,
    FormData: dom.window.FormData,
  };
  for (const [key, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  return dom;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const baseRequest = {
  id: "request-1",
  createdByUserId: "user-9",
  publisherCommunityId: "community-1",
  publisherTeamId: null,
  publisherAthletesCommunityId: null,
  audienceScope: "PUBLIC",
  audienceCommunityId: null,
  audienceAthletesCommunityId: null,
  category: "ITEM",
  itemKind: "FOOTWEAR",
  sport: "RUNNING",
  requester: {
    displayName: "Yassine K.",
    username: "yassine.k",
    photoUrl: "https://cdn.example.test/yassine.jpg",
  },
  title: "Need size 43 running shoes",
  description: "Looking for used or new running shoes for training.",
  quantityNeeded: 1,
  sizeLabel: "43",
  conditionPreference: "USED_OK",
  placeId: null,
  city: "La Marsa",
  houma: null,
  fullAddress: "12 Private Street",
  locationNote: null,
  neededByAt: null,
  expiresAt: null,
  status: "OPEN",
  fulfilledAt: null,
  cancelledAt: null,
  createdAt: "2026-09-17T12:00:00.000Z",
  updatedAt: "2026-09-17T12:00:00.000Z",
};

function me(id: string, role: "FOUNDER" | "MEMBER") {
  return {
    id,
    presentation: { username: "u", displayName: "U", photoUrl: null, bio: null },
    transports: ["web"],
    platformRoles: [],
    managerCapabilities: [],
    communities: [{ id: "community-1", name: "Tunis HOOMA", slug: "tunis", role }],
    athletesCommunities: [],
    moderation: {
      yellowCardCount: 0,
      isBanned: false,
      banExpiresAt: null,
      isReadOnly: false,
      readOnlyExpiresAt: null,
      isDisabled: false,
    },
    teams: [],
  };
}

const otherResponse = {
  id: "response-1",
  requestId: "request-1",
  responderUserId: "user-2",
  message: "I have a spare pair.",
  status: "PENDING",
  responder: {
    displayName: "Bashir",
    username: "bashir",
    photoUrl: "https://cdn.example.test/bashir.jpg",
  },
  createdAt: "2026-09-17T13:00:00.000Z",
  updatedAt: "2026-09-17T13:00:00.000Z",
  acceptedAt: null,
  declinedAt: null,
  withdrawnAt: null,
};

const ownResponse = {
  ...otherResponse,
  id: "response-1",
  responderUserId: "user-1",
  responder: {
    displayName: "U",
    username: "u",
    photoUrl: null,
  },
};

function installApiStub(options: {
  readonly me?: unknown;
  readonly request?: unknown;
  readonly responses?: readonly unknown[];
  readonly refreshedRequest?: unknown;
  readonly refreshedResponses?: readonly unknown[];
  readonly actionStatus?: number;
  readonly actionBody?: unknown;
  readonly imageDelivery?: unknown;
  readonly imageStatus?: number;
  readonly detailStatus?: number;
  readonly detailBody?: unknown;
}) {
  const calls: string[] = [];
  let requestState = options.request ?? baseRequest;
  let responseState = [...(options.responses ?? [])];
  let memberDetailReads = 0;
  let responseReads = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const key = `${method} ${url.pathname}`;
    calls.push(key);
    if (url.pathname === "/api/public/v1/auth/session") return json(options.me ?? null);
    if (url.pathname.endsWith("/requests/request-1/image/delivery") && options.imageStatus)
      return json(
        { error: { code: "MEDIA_UNAVAILABLE", message: "Request image is unavailable" } },
        options.imageStatus,
      );
    if (url.pathname === "/api/public/v1/requests/request-1/image/delivery")
      return json(
        options.imageDelivery ?? {
          contentUrl: "https://cdn.example.test/request.webp",
          expiresAt: null,
        },
      );
    if (url.pathname === "/api/v1/requests/request-1/image/delivery")
      return json(
        options.imageDelivery ?? {
          contentUrl: "https://cdn.example.test/request.webp",
          expiresAt: "2026-09-23T13:05:00.000Z",
        },
      );
    if (url.pathname.endsWith("/requests/request-1") && method === "GET") {
      if (options.detailStatus) return json(options.detailBody, options.detailStatus);
      if (url.pathname.startsWith("/api/v1/")) {
        memberDetailReads += 1;
        if (memberDetailReads > 1 && options.refreshedRequest) {
          requestState = options.refreshedRequest;
        }
      }
      return json(requestState);
    }
    if (url.pathname === "/api/v1/requests/request-1/responses" && method === "GET") {
      responseReads += 1;
      if (responseReads > 1 && options.refreshedResponses) {
        responseState = [...options.refreshedResponses];
      }
      return json({ items: responseState });
    }
    if (url.pathname === "/api/v1/requests/request-1/responses" && method === "POST") {
      if (options.actionStatus && options.actionStatus >= 400)
        return json(options.actionBody, options.actionStatus);
      const created = {
        ...otherResponse,
        id: "response-own",
        responderUserId: "user-1",
        responder: { displayName: "U", username: "u", photoUrl: null },
      };
      responseState = [created];
      return json(created, 201);
    }
    if (
      url.pathname === "/api/v1/requests/request-1/responses/response-1/accept" &&
      method === "POST"
    ) {
      if (options.actionStatus && options.actionStatus >= 400)
        return json(options.actionBody, options.actionStatus);
      const accepted = {
        ...otherResponse,
        status: "ACCEPTED",
        acceptedAt: "2026-09-17T14:00:00.000Z",
      };
      requestState = { ...(requestState as typeof baseRequest), status: "IN_PROGRESS" };
      responseState = responseState.map((response) =>
        (response as { id?: string }).id === "response-1" ? accepted : response,
      );
      return json(accepted);
    }
    if (
      url.pathname === "/api/v1/requests/request-1/responses/response-1/decline" &&
      method === "POST"
    ) {
      if (options.actionStatus && options.actionStatus >= 400)
        return json(options.actionBody, options.actionStatus);
      const declined = {
        ...otherResponse,
        status: "DECLINED",
        declinedAt: "2026-09-17T14:00:00.000Z",
      };
      responseState = responseState.map((response) =>
        (response as { id?: string }).id === "response-1" ? declined : response,
      );
      return json(declined);
    }
    if (url.pathname.endsWith("/responses/response-1/withdraw") && method === "POST") {
      const current = responseState.find(
        (response) => (response as { id?: string }).id === "response-1",
      );
      const withdrawn = {
        ...(current ?? otherResponse),
        status: "WITHDRAWN",
        withdrawnAt: "2026-09-17T14:00:00.000Z",
      };
      responseState = [withdrawn];
      return json(withdrawn);
    }
    if (url.pathname.endsWith("/fulfill") && method === "POST") {
      if (options.actionStatus && options.actionStatus >= 400)
        return json(options.actionBody, options.actionStatus);
      requestState = { ...(requestState as typeof baseRequest), status: "FULFILLED" };
      return json(requestState);
    }
    if (url.pathname.endsWith("/cancel") && method === "POST") {
      if (options.actionStatus && options.actionStatus >= 400)
        return json(options.actionBody, options.actionStatus);
      requestState = { ...(requestState as typeof baseRequest), status: "CANCELLED" };
      return json(requestState);
    }
    if (method === "POST") {
      if (options.actionStatus && options.actionStatus >= 400)
        return json(options.actionBody, options.actionStatus);
      return json({ ...(options.request ?? baseRequest), status: "IN_PROGRESS" });
    }
    return json({ error: { code: "NOT_FOUND", message: `Unexpected ${key}` } }, 404);
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

async function renderDetail(options: Parameters<typeof installApiStub>[0]) {
  const dom = installDom();
  const stub = installApiStub(options);
  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider, RequestDetailPage } = await import("@hooma/frontend");
  const view = render(
    React.createElement(
      HoomaFrontendProvider,
      {
        transport: {
          baseUrl: "http://api.test",
          authenticationHref: (returnTo: string) =>
            `/login?returnTo=${encodeURIComponent(returnTo)}`,
        },
      },
      React.createElement(RequestDetailPage, { requestId: "request-1" }),
    ),
  );
  return {
    view,
    calls: stub.calls,
    fireEvent,
    waitFor,
    close: () => {
      stub.restore();
      cleanup();
      dom.window.close();
    },
  };
}

test("a guest reads the public detail and is routed through auth to respond", async () => {
  const page = await renderDetail({ me: null });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Need size 43 running shoes")));
    assert.deepEqual(
      page.calls.filter((c) => c.includes("/requests/")),
      ["GET /api/public/v1/requests/request-1"],
    );
    const link = page.view.getByRole("link", { name: /Sign in to respond/i });
    assert.equal(link.getAttribute("href"), "/login?returnTo=%2Frequests%2Frequest-1");
    assert.equal(page.view.queryByRole("button", { name: /Send response/i }), null);
    assert.equal(page.view.queryByText("12 Private Street"), null);
  } finally {
    page.close();
  }
});

test("Request detail links requester identity to the canonical public profile", async () => {
  const page = await renderDetail({ me: null });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Need size 43 running shoes")));
    const requester = page.view.getByRole("link", { name: /Yassine K\./ });
    assert.equal(requester.getAttribute("href"), "/profile/yassine.k");
    assert.equal(
      requester.querySelector("img")?.getAttribute("src"),
      "https://cdn.example.test/yassine.jpg",
    );
  } finally {
    page.close();
  }
});

test("an eligible signed-in member sends one response and may withdraw it", async () => {
  const page = await renderDetail({ me: me("user-1", "MEMBER") });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: /Send response/i })));
    page.fireEvent.change(page.view.getByLabelText(/your message|message/i), {
      target: { value: "I can help." },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Send response/i }));
    await page.waitFor(() => assert.ok(page.view.getByText("Your response")));
    assert.ok(page.calls.includes("POST /api/v1/requests/request-1/responses"));
    assert.ok(page.view.getByRole("button", { name: /Withdraw response/i }));
    assert.equal(page.view.queryByText(/user-1|user-2/), null);
  } finally {
    page.close();
  }
});

test("a manager sees responder presentation, can accept, fulfil, and never fakes success on conflict", async () => {
  const ok = await renderDetail({ me: me("user-1", "FOUNDER"), responses: [otherResponse] });
  try {
    const responder = await ok.view.findByRole("link", { name: /Bashir/ });
    assert.equal(responder.getAttribute("href"), "/profile/bashir");
    assert.equal(
      responder.querySelector("img")?.getAttribute("src"),
      "https://cdn.example.test/bashir.jpg",
    );
    assert.equal(ok.view.queryByText(/user-2/), null);
    ok.fireEvent.click(ok.view.getByRole("button", { name: /^Accept$/i }));
    await ok.waitFor(() => {
      assert.ok(ok.calls.includes("POST /api/v1/requests/request-1/responses/response-1/accept"));
      assert.ok(ok.view.getByRole("link", { name: /Bashir/ }));
      assert.ok(ok.view.getByText("Accepted"));
    });
    ok.fireEvent.click(ok.view.getByRole("button", { name: /Mark fulfilled/i }));
    await ok.waitFor(() => assert.ok(ok.calls.includes("POST /api/v1/requests/request-1/fulfill")));
  } finally {
    ok.close();
  }

  const conflict = await renderDetail({
    me: me("user-1", "FOUNDER"),
    responses: [otherResponse],
    actionStatus: 409,
    actionBody: { error: { code: "CONFLICT", message: "Request state changed" } },
  });
  try {
    await conflict.waitFor(() => assert.ok(conflict.view.getByRole("link", { name: /Bashir/ })));
    conflict.fireEvent.click(conflict.view.getByRole("button", { name: /^Accept$/i }));
    await conflict.waitFor(() =>
      assert.ok(conflict.view.container.querySelector(".request-error")),
    );
    const text = conflict.view.container.textContent ?? "";
    assert.ok(text.includes("Request state changed"), "server conflict message must surface");
    assert.ok(text.includes("Open"), "lifecycle must not be forced to a new state on failure");
  } finally {
    conflict.close();
  }
});

test("Request detail resolves public image delivery only when media exists", async () => {
  const page = await renderDetail({
    me: null,
    request: {
      ...baseRequest,
      image: {
        id: "image-1",
        source: "EXTERNAL_URL",
        contentType: null,
        sizeBytes: null,
        updatedAt: "2026-09-23T13:00:00.000Z",
      },
    },
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("img", { name: /Request image/i })));
    assert.ok(page.calls.includes("GET /api/public/v1/requests/request-1/image/delivery"));
    assert.equal(
      page.view.getByRole("img", { name: /Request image/i }).getAttribute("src"),
      "https://cdn.example.test/request.webp",
    );
  } finally {
    page.close();
  }
});

test("signed-in Request detail uses the member image delivery path", async () => {
  const page = await renderDetail({
    me: me("user-1", "MEMBER"),
    request: {
      ...baseRequest,
      image: {
        id: "image-1",
        source: "UPLOAD",
        contentType: "image/webp",
        sizeBytes: 1200,
        updatedAt: "2026-09-23T13:00:00.000Z",
      },
    },
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("img", { name: /Request image/i })));
    assert.ok(page.calls.includes("GET /api/v1/requests/request-1/image/delivery"));
    assert.equal(
      page.calls.includes("GET /api/public/v1/requests/request-1/image/delivery"),
      false,
    );
  } finally {
    page.close();
  }
});

test("an entity Request historical creator sees neither manager controls nor a response composer", async () => {
  const page = await renderDetail({
    me: me("user-1", "MEMBER"),
    request: {
      ...baseRequest,
      createdByUserId: "user-1",
      publisherCommunityId: "community-1",
    },
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Need size 43 running shoes")));
    assert.equal(Boolean(page.view.queryByRole("button", { name: /Send response/i })), false);
    assert.equal(Boolean(page.view.queryByRole("button", { name: /Mark fulfilled/i })), false);
    assert.equal(Boolean(page.view.queryByRole("button", { name: /Cancel Request/i })), false);
  } finally {
    page.close();
  }
});

test("an eligible unrelated member can respond while a current manager never sees the composer", async () => {
  const member = await renderDetail({ me: me("user-1", "MEMBER") });
  try {
    await member.waitFor(() =>
      assert.ok(member.view.getByRole("button", { name: /Send response/i })),
    );
  } finally {
    member.close();
  }

  const manager = await renderDetail({ me: me("user-1", "FOUNDER") });
  try {
    await manager.waitFor(() => assert.ok(manager.view.getByText("Need size 43 running shoes")));
    assert.equal(manager.view.queryByRole("button", { name: /Send response/i }), null);
  } finally {
    manager.close();
  }
});

test("a responder sees one singular private response rather than a message history", async () => {
  const page = await renderDetail({ me: me("user-1", "MEMBER"), responses: [ownResponse] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("heading", { name: "Your response" })));
    assert.equal(page.view.queryByRole("heading", { name: "Your responses" }), null);
    assert.equal(page.view.queryByRole("heading", { name: /chat|thread|conversation/i }), null);
    assert.equal(page.view.queryByText(/message history|send another message/i), null);
  } finally {
    page.close();
  }
});

test("manager acceptance reloads canonical detail and authorized responses", async () => {
  const accepted = { ...otherResponse, status: "ACCEPTED", acceptedAt: "2026-09-17T14:00:00.000Z" };
  const page = await renderDetail({
    me: me("user-1", "FOUNDER"),
    responses: [otherResponse],
    refreshedRequest: { ...baseRequest, status: "IN_PROGRESS" },
    refreshedResponses: [accepted],
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("heading", { name: "Responses" })));
    assert.equal(page.view.queryByRole("button", { name: /Send response/i }), null);
    page.fireEvent.click(page.view.getByRole("button", { name: /^Accept$/i }));
    await page.waitFor(() => assert.ok(page.view.getByText("In Progress")));
    assert.ok(page.view.getByText("Accepted"));
    assert.equal(page.calls.filter((call) => call === "GET /api/v1/requests/request-1").length, 2);
    assert.equal(
      page.calls.filter((call) => call === "GET /api/v1/requests/request-1/responses").length,
      2,
    );
  } finally {
    page.close();
  }
});

test("a manager can decline a pending response", async () => {
  const page = await renderDetail({ me: me("user-1", "FOUNDER"), responses: [otherResponse] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: /^Decline$/i })));
    page.fireEvent.click(page.view.getByRole("button", { name: /^Decline$/i }));
    await page.waitFor(() => assert.ok(page.view.getByText("Declined")));
    assert.ok(page.calls.includes("POST /api/v1/requests/request-1/responses/response-1/decline"));
  } finally {
    page.close();
  }
});

test("a responder can withdraw a pending response", async () => {
  const page = await renderDetail({ me: me("user-1", "MEMBER"), responses: [ownResponse] });
  try {
    await page.waitFor(() =>
      assert.ok(page.view.getByRole("button", { name: /Withdraw response/i })),
    );
    page.fireEvent.click(page.view.getByRole("button", { name: /Withdraw response/i }));
    await page.waitFor(() => assert.ok(page.view.getByText("Withdrawn")));
    assert.ok(page.calls.includes("POST /api/v1/requests/request-1/responses/response-1/withdraw"));
  } finally {
    page.close();
  }
});

test("withdrawing an accepted response preserves the canonical IN_PROGRESS Request", async () => {
  const page = await renderDetail({
    me: me("user-1", "MEMBER"),
    request: { ...baseRequest, status: "IN_PROGRESS" },
    responses: [{ ...ownResponse, status: "ACCEPTED", acceptedAt: "2026-09-17T14:00:00.000Z" }],
  });
  try {
    await page.waitFor(() =>
      assert.ok(page.view.getByRole("button", { name: /Withdraw response/i })),
    );
    page.fireEvent.click(page.view.getByRole("button", { name: /Withdraw response/i }));
    await page.waitFor(() => assert.ok(page.view.getByText("Withdrawn")));
    assert.ok(page.view.getByText("In Progress"));
  } finally {
    page.close();
  }
});

test("manager lifecycle actions render canonical fulfilled and cancelled terminal states", async () => {
  const fulfilled = await renderDetail({ me: me("user-1", "FOUNDER") });
  try {
    await fulfilled.waitFor(() =>
      assert.ok(fulfilled.view.getByRole("button", { name: /Mark fulfilled/i })),
    );
    fulfilled.fireEvent.click(fulfilled.view.getByRole("button", { name: /Mark fulfilled/i }));
    await fulfilled.waitFor(() => assert.ok(fulfilled.view.getByText("Fulfilled")));
    assert.equal(fulfilled.view.queryByRole("button", { name: /Cancel Request/i }), null);
  } finally {
    fulfilled.close();
  }

  const cancelled = await renderDetail({ me: me("user-1", "FOUNDER") });
  try {
    await cancelled.waitFor(() =>
      assert.ok(cancelled.view.getByRole("button", { name: /Cancel Request/i })),
    );
    cancelled.fireEvent.click(cancelled.view.getByRole("button", { name: /Cancel Request/i }));
    await cancelled.waitFor(() => assert.ok(cancelled.view.getByText("Cancelled")));
    assert.equal(cancelled.view.queryByRole("button", { name: /Mark fulfilled/i }), null);
  } finally {
    cancelled.close();
  }
});

test("terminal Requests explain their state and expose no mutation controls", async () => {
  const expectations = [
    ["FULFILLED", /This Request has been fulfilled/i],
    ["CANCELLED", /This Request was cancelled/i],
    ["EXPIRED", /This Request has expired/i],
  ] as const;

  for (const [status, explanation] of expectations) {
    const page = await renderDetail({
      me: me("user-1", "FOUNDER"),
      request: { ...baseRequest, status },
    });
    try {
      await page.waitFor(() => assert.ok(page.view.getByText(explanation)));
      assert.equal(page.view.queryByRole("button", { name: /Mark fulfilled/i }), null);
      assert.equal(page.view.queryByRole("button", { name: /Cancel Request/i }), null);
      assert.equal(page.view.queryByRole("button", { name: /Send response/i }), null);
    } finally {
      page.close();
    }
  }
});

test("detail presents canonical taxonomy, product, safe location and timing facts without fullAddress", async () => {
  const page = await renderDetail({
    me: null,
    request: {
      ...baseRequest,
      houma: "Sidi Bou Said",
      city: "Tunis",
      locationNote: "Meet by the public library",
      neededByAt: "2026-10-01T12:00:00.000Z",
      expiresAt: "2026-10-05T12:00:00.000Z",
      customNeed: "Adult size with road sole",
      taxonomy: {
        requestType: "SPORT",
        sport: "RUNNING",
        sportLabel: "Running",
        subcategory: { id: "subcategory-1", slug: "footwear", label: "Footwear" },
        need: {
          id: "need-1",
          slug: "running-shoes",
          label: "Running shoes",
          kind: "PRODUCT",
          allowsCustomText: true,
        },
      },
    },
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Need size 43 running shoes")));
    const text = page.view.container.textContent ?? "";
    for (const expected of [
      "Sport",
      "Running",
      "Footwear",
      "Running shoes",
      "Adult size with road sole",
      "Sidi Bou Said",
      "Tunis",
      "Meet by the public library",
      "Needed by",
      "Expires",
      "Quantity",
      "Size",
      "Condition",
    ]) {
      assert.ok(text.includes(expected), `missing detail fact: ${expected}`);
    }
    assert.equal(text.includes("12 Private Street"), false);
  } finally {
    page.close();
  }
});

test("detail load errors remain explicit", async () => {
  const page = await renderDetail({
    me: null,
    detailStatus: 404,
    detailBody: { error: { code: "REQUEST_NOT_FOUND", message: "Request not found" } },
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Request not found")));
    assert.ok(page.view.container.querySelector(".request-error"));
  } finally {
    page.close();
  }
});

test("image delivery failure preserves Request content and shows bounded media feedback", async () => {
  const page = await renderDetail({
    me: null,
    imageStatus: 503,
    request: {
      ...baseRequest,
      image: {
        id: "image-1",
        source: "UPLOAD",
        contentType: "image/webp",
        sizeBytes: 1200,
        updatedAt: "2026-09-23T13:00:00.000Z",
      },
    },
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Request image is unavailable")));
    assert.ok(page.view.getByText("Need size 43 running shoes"));
    assert.equal(page.view.queryByRole("img", { name: /Request image/i }), null);
  } finally {
    page.close();
  }
});

test("a 409 preserves its error while refreshing canonical detail and responses", async () => {
  const page = await renderDetail({
    me: me("user-1", "FOUNDER"),
    responses: [otherResponse],
    actionStatus: 409,
    actionBody: { error: { code: "CONFLICT", message: "Request state changed" } },
    refreshedRequest: { ...baseRequest, status: "IN_PROGRESS" },
    refreshedResponses: [
      { ...otherResponse, status: "ACCEPTED", acceptedAt: "2026-09-17T14:00:00.000Z" },
    ],
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: /^Accept$/i })));
    page.fireEvent.click(page.view.getByRole("button", { name: /^Accept$/i }));
    await page.waitFor(() => assert.ok(page.view.getByText("Request state changed")));
    assert.ok(page.view.getByText("In Progress"));
    assert.ok(page.view.getByText("Accepted"));
    assert.equal(page.calls.filter((call) => call === "GET /api/v1/requests/request-1").length, 2);
    assert.equal(
      page.calls.filter((call) => call === "GET /api/v1/requests/request-1/responses").length,
      2,
    );
  } finally {
    page.close();
  }
});

test("detail back navigation uses the established SVG icon language", async () => {
  const page = await renderDetail({ me: null });
  try {
    const back = await page.view.findByRole("link", { name: /Requests/i });
    assert.equal(back.textContent?.includes("←"), false);
    assert.ok(back.querySelector("svg"));
  } finally {
    page.close();
  }
});
