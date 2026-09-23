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
  title: "Need size 43 running shoes",
  description: "Looking for used or new running shoes for training.",
  quantityNeeded: 1,
  sizeLabel: "43",
  conditionPreference: "USED_OK",
  placeId: null,
  city: "La Marsa",
  houma: null,
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
  createdAt: "2026-09-17T13:00:00.000Z",
  updatedAt: "2026-09-17T13:00:00.000Z",
  acceptedAt: null,
  declinedAt: null,
  withdrawnAt: null,
};

function installApiStub(options: {
  readonly me?: unknown;
  readonly request?: unknown;
  readonly responses?: readonly unknown[];
  readonly actionStatus?: number;
  readonly actionBody?: unknown;
  readonly imageDelivery?: unknown;
}) {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const key = `${method} ${url.pathname}`;
    calls.push(key);
    if (url.pathname === "/api/public/v1/auth/session") return json(options.me ?? null);
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
    if (url.pathname === "/api/public/v1/requests/request-1")
      return json(options.request ?? baseRequest);
    if (url.pathname === "/api/v1/requests/request-1") return json(options.request ?? baseRequest);
    if (url.pathname === "/api/v1/requests/request-1/responses" && method === "GET")
      return json({ items: options.responses ?? [] });
    if (url.pathname === "/api/v1/requests/request-1/responses" && method === "POST") {
      if (options.actionStatus && options.actionStatus >= 400)
        return json(options.actionBody, options.actionStatus);
      return json({ ...otherResponse, id: "response-own", responderUserId: "user-1" }, 201);
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

test("a manager sees player responses, can accept, fulfil, and never fakes success on conflict", async () => {
  const ok = await renderDetail({ me: me("user-1", "FOUNDER"), responses: [otherResponse] });
  try {
    await ok.waitFor(() => assert.ok(ok.view.getByText("Player response")));
    assert.equal(ok.view.queryByText(/user-2/), null);
    ok.fireEvent.click(ok.view.getByRole("button", { name: /^Accept$/i }));
    await ok.waitFor(() =>
      assert.ok(ok.calls.includes("POST /api/v1/requests/request-1/responses/response-1/accept")),
    );
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
    await conflict.waitFor(() => assert.ok(conflict.view.getByText("Player response")));
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
