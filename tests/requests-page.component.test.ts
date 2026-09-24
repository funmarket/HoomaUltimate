import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";
import { JSDOM } from "jsdom";
import { requestsTaxonomy } from "./fixtures/requests-taxonomy.js";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
    }
    return nextLoad(url, context);
  },
});

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

    await api.publicList({
      limit: 30,
      category: "ITEM",
      requestType: "SPORT",
      city: "La Marsa",
      q: "goalkeeper gloves",
    });
    await api.memberList();
    await api.create(createInput);
    await api.respond("request-1", { message: "I can help with a spare pair." });

    assert.deepEqual(calls, [
      {
        path: "/api/public/v1/requests?limit=30&category=ITEM&requestType=SPORT&city=La+Marsa&q=goalkeeper+gloves",
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

/* ------------------------------------------------------------------ *
 * Requests page component behaviour (public feed, member feed, filters)
 * ------------------------------------------------------------------ */

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/requests",
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
    HTMLSelectElement: dom.window.HTMLSelectElement,
    HTMLInputElement: dom.window.HTMLInputElement,
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

type StubOptions = {
  readonly me?: unknown;
  readonly publicItems?: readonly unknown[];
  readonly publicSearchItems?: readonly unknown[];
  readonly publicNextCursor?: string | null;
  readonly publicPageTwoItems?: readonly unknown[];
  readonly memberItems?: readonly unknown[];
};

function installApiStub(options: StubOptions) {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? "GET"} ${url.pathname}${url.search}`;
    calls.push(key);
    if (url.pathname === "/api/public/v1/auth/session") return json(options.me ?? null);
    if (url.pathname === "/api/public/v1/help/taxonomy") return json(requestsTaxonomy);
    if (url.pathname === "/api/public/v1/requests") {
      if (url.searchParams.get("cursor")) {
        return json({ items: options.publicPageTwoItems ?? [], nextCursor: null });
      }
      if (url.searchParams.has("q") && options.publicSearchItems) {
        return json({ items: options.publicSearchItems, nextCursor: null });
      }
      return json({
        items: options.publicItems ?? [],
        nextCursor: options.publicNextCursor ?? null,
      });
    }
    if (url.pathname === "/api/public/v1/requests/request-1/image/delivery") {
      return json({ contentUrl: "https://cdn.example.test/request.webp", expiresAt: null });
    }
    if (url.pathname === "/api/v1/requests/request-1/image/delivery") {
      return json({ contentUrl: "https://cdn.example.test/request.webp", expiresAt: null });
    }
    if (url.pathname === "/api/v1/requests") {
      return json({ items: options.memberItems ?? [], nextCursor: null });
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

const publicRequest = {
  id: "request-1",
  createdByUserId: "user-2",
  publisherCommunityId: null,
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
  locationNote: null,
  neededByAt: null,
  expiresAt: null,
  status: "OPEN",
  fulfilledAt: null,
  cancelledAt: null,
  createdAt: "2026-09-17T12:00:00.000Z",
  updatedAt: "2026-09-17T12:00:00.000Z",
};

const meResponse = {
  id: "user-1",
  presentation: { username: "coach", displayName: "Coach Amine", photoUrl: null, bio: null },
  transports: ["web"],
  platformRoles: [],
  managerCapabilities: [],
  communities: [],
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

async function renderRequestsPage(options: StubOptions) {
  const dom = installDom();
  const stub = installApiStub(options);
  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render, waitFor, within } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("../packages/frontend/src/context");
  const { RequestsPage } = await import("../packages/frontend/src/requests/RequestsPage");
  const view = render(
    React.createElement(
      HoomaFrontendProvider,
      { transport: { baseUrl: "http://api.test" } },
      React.createElement(RequestsPage, { tab: "requests" }),
    ),
  );
  return {
    view,
    calls: stub.calls,
    waitFor,
    fireEvent,
    within,
    close: () => {
      stub.restore();
      cleanup();
      dom.window.close();
    },
  };
}

test("anonymous /requests loads the real public Requests feed", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [publicRequest] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Need size 43 running shoes")));
    assert.equal(page.view.queryByText("No Requests are listed yet."), null);
    assert.ok(page.view.getByRole("link", { name: /New Request/i }));
    assert.ok(page.view.getByText("Players help players. Stronger together."));
    assert.ok(page.view.getByRole("link", { name: /FundMe/i }));
    assert.ok(page.view.getByRole("link", { name: /Donations/i }));
    const card = page.view.getByRole("button", { name: /Need size 43 running shoes/i });
    assert.equal(card.getAttribute("aria-expanded"), "false");
    const cardView = page.within(card);
    assert.ok(cardView.getByText("Item"));
    assert.ok(cardView.getByText("Open"));
    assert.ok(cardView.getByText("La Marsa"));
    assert.deepEqual(
      page.calls.filter((call) => call.includes("/requests")),
      ["GET /api/public/v1/requests?requestType=SPORT&surface=REQUESTS"],
    );
  } finally {
    page.close();
  }
});

test("Request cards link requester identity to the canonical public profile", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [publicRequest] });
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

test("Request cards expand inline without nesting profile or detail links in the toggle", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [publicRequest] });
  try {
    const toggle = await page.view.findByRole("button", { name: /Need size 43 running shoes/i });
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(toggle.querySelector("a"), null);
    assert.equal(page.view.queryByText("Size · 43"), null);

    page.fireEvent.click(toggle);

    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.ok(page.view.getByText("Size · 43"));
    assert.ok(page.view.getByText("Condition · Used Ok"));
    assert.equal(
      page.view.getByRole("link", { name: "View full Request" }).getAttribute("href"),
      "/requests/request-1",
    );
    assert.equal(
      page.view.getByRole("link", { name: /Yassine K\./ }).getAttribute("href"),
      "/profile/yassine.k",
    );
  } finally {
    page.close();
  }
});

test("Request feed lazily resolves canonical image delivery only for cards with media", async () => {
  const originalObserver = globalThis.IntersectionObserver;
  let reveal = () => {};
  class IntersectionObserverStub {
    readonly root = null;
    readonly rootMargin = "240px";
    readonly thresholds = [0];
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      reveal = () =>
        this.callback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver,
        );
    }
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  Object.defineProperty(globalThis, "IntersectionObserver", {
    value: IntersectionObserverStub,
    configurable: true,
    writable: true,
  });
  const page = await renderRequestsPage({
    me: null,
    publicItems: [
      {
        ...publicRequest,
        image: {
          id: "image-1",
          source: "EXTERNAL_URL",
          contentType: null,
          sizeBytes: null,
          updatedAt: "2026-09-23T13:00:00.000Z",
        },
      },
    ],
  });
  try {
    await page.view.findByRole("button", { name: /Need size 43 running shoes/i });
    assert.equal(
      page.calls.filter((call) => call.endsWith("/requests/request-1/image/delivery")).length,
      0,
    );
    reveal();
    const image = await page.view.findByRole("img", { name: /Need size 43 running shoes/i });
    assert.equal(image.getAttribute("src"), "https://cdn.example.test/request.webp");
    assert.equal(
      page.calls.filter((call) => call.endsWith("/requests/request-1/image/delivery")).length,
      1,
    );
  } finally {
    page.close();
    if (originalObserver) {
      Object.defineProperty(globalThis, "IntersectionObserver", {
        value: originalObserver,
        configurable: true,
        writable: true,
      });
    } else {
      Reflect.deleteProperty(globalThis, "IntersectionObserver");
    }
  }
});

test("signed-in visitor uses the member list endpoint and an empty result is a legitimate state", async () => {
  const page = await renderRequestsPage({ me: { id: "user-1" }, memberItems: [] });
  try {
    await page.waitFor(() =>
      assert.ok(page.calls.includes("GET /api/v1/requests?requestType=SPORT&surface=REQUESTS")),
    );
    assert.match(document.body.textContent ?? "", /No Requests are listed yet\./);
    assert.deepEqual(
      page.calls.filter((call) => call.includes("/requests")),
      ["GET /api/v1/requests?requestType=SPORT&surface=REQUESTS"],
    );
  } finally {
    page.close();
  }
});

const secondPublicRequest = {
  ...publicRequest,
  id: "request-2",
  title: "Need training cones",
  description: "Looking for training cones for an evening football session.",
};

test("Load more appends the next cursor page without replacing existing Requests", async () => {
  const page = await renderRequestsPage({
    me: null,
    publicItems: [publicRequest],
    publicNextCursor: "cursor-2",
    publicPageTwoItems: [secondPublicRequest],
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Need size 43 running shoes")));
    page.fireEvent.click(page.view.getByRole("button", { name: /Load more/i }));
    await page.waitFor(() => assert.ok(page.view.getByText("Need training cones")));
    assert.ok(page.view.getByText("Need size 43 running shoes"));
    assert.ok(
      page.calls.includes(
        "GET /api/public/v1/requests?cursor=cursor-2&requestType=SPORT&surface=REQUESTS",
      ),
      `expected cursor request, saw ${page.calls.join(" | ")}`,
    );
  } finally {
    page.close();
  }
});

test("City filter debounces list reloads and does not repeat identity lookup", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("No Requests are listed yet.")));
    page.calls.length = 0;

    page.fireEvent.click(page.view.getByRole("button", { name: "Filters" }));
    const city = page.view.getByLabelText("City");
    page.fireEvent.change(city, { target: { value: "T" } });
    page.fireEvent.change(city, { target: { value: "Tu" } });
    page.fireEvent.change(city, { target: { value: "Tunis" } });

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(page.calls.filter((call) => call.includes("/requests")).length, 0);
    page.fireEvent.click(page.view.getByRole("button", { name: "Apply" }));

    await page.waitFor(
      () => {
        assert.deepEqual(
          page.calls.filter((call) => call.includes("/requests")),
          ["GET /api/public/v1/requests?requestType=SPORT&surface=REQUESTS&city=Tunis"],
        );
      },
      { timeout: 1000 },
    );
    assert.equal(page.calls.filter((call) => call.includes("/auth/session")).length, 0);
  } finally {
    page.close();
  }
});

test("Search filter debounces list reloads, resets pagination and serializes q", async () => {
  const page = await renderRequestsPage({
    me: null,
    publicItems: [publicRequest],
    publicSearchItems: [],
    publicNextCursor: "cursor-1",
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText(publicRequest.title)));
    assert.ok(page.view.getByRole("button", { name: "Load more" }));
    page.calls.length = 0;

    const search = page.view.getByLabelText("Search Requests");
    page.fireEvent.change(search, { target: { value: "g" } });
    page.fireEvent.change(search, { target: { value: "goal" } });
    page.fireEvent.change(search, { target: { value: "goalkeeper gloves" } });

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(page.calls.filter((call) => call.includes("/requests")).length, 0);

    await page.waitFor(
      () => {
        assert.deepEqual(
          page.calls.filter((call) => call.includes("/requests")),
          ["GET /api/public/v1/requests?requestType=SPORT&surface=REQUESTS&q=goalkeeper+gloves"],
        );
      },
      { timeout: 1000 },
    );
    assert.ok(page.view.getByText("No Requests match these filters."));
    assert.equal(page.view.queryByRole("button", { name: "Load more" }), null);
  } finally {
    page.close();
  }
});

test("switching roots clears dependent sport, category and need filters", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("No Requests are listed yet.")));
    page.fireEvent.click(page.view.getByRole("button", { name: "Running" }));
    page.fireEvent.click(page.view.getByRole("button", { name: "Filters" }));
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-running-footwear" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-running-shoes" },
    });
    page.fireEvent.click(page.view.getByRole("button", { name: "Apply" }));
    await page.waitFor(() =>
      assert.ok(page.calls.some((call) => call.includes("needId=htn-running-shoes"))),
    );

    page.calls.length = 0;
    page.fireEvent.click(page.view.getByRole("button", { name: "Community" }));
    await page.waitFor(() =>
      assert.deepEqual(
        page.calls.filter((call) => call.includes("/requests")),
        ["GET /api/public/v1/requests?requestType=COMMUNITY&surface=REQUESTS"],
      ),
    );
  } finally {
    page.close();
  }
});

test("Community filters use the same canonical Request list query", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("No Requests are listed yet.")));
    page.calls.length = 0;

    page.fireEvent.click(page.view.getByRole("button", { name: "Community" }));
    page.fireEvent.click(page.view.getByRole("button", { name: "Lost & Found" }));
    page.fireEvent.click(page.view.getByRole("button", { name: "Filters" }));
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-community-lost-item" },
    });
    page.fireEvent.click(page.view.getByRole("button", { name: "Apply" }));

    await page.waitFor(() =>
      assert.ok(
        page.calls.some(
          (call) =>
            call.includes("requestType=COMMUNITY") &&
            call.includes("subcategoryId=hts-community-lost-found") &&
            call.includes("needId=htn-community-lost-item"),
        ),
        `expected Community filtered Request call, saw ${page.calls.join(" | ")}`,
      ),
    );
    assert.equal(page.view.queryByRole("button", { name: "Running" }), null);
  } finally {
    page.close();
  }
});

test("filters call the existing list query model", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [publicRequest] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Need size 43 running shoes")));
    assert.equal(
      page.view.getByRole("button", { name: "Sport" }).getAttribute("aria-pressed"),
      "true",
    );
    page.fireEvent.click(page.view.getByRole("button", { name: "Running" }));
    page.fireEvent.click(page.view.getByRole("button", { name: "Filters" }));
    page.fireEvent.change(page.view.getByLabelText("City"), { target: { value: "La Marsa" } });
    page.fireEvent.click(page.view.getByRole("button", { name: "Apply" }));
    await page.waitFor(() =>
      assert.ok(
        page.calls.some((call) => call.includes("sport=RUNNING") && call.includes("city=La+Marsa")),
        `expected filtered public list call, saw ${page.calls.join(" | ")}`,
      ),
    );
  } finally {
    page.close();
  }
});

test("advanced filter count excludes root and quick rail and Reset clears applied fields", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [publicRequest] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText(publicRequest.title)));
    page.fireEvent.click(page.view.getByRole("button", { name: "Running" }));
    page.fireEvent.click(page.view.getByRole("button", { name: "Filters" }));
    page.fireEvent.change(page.view.getByLabelText("City"), { target: { value: "La Marsa" } });
    page.fireEvent.change(page.view.getByLabelText("Status"), { target: { value: "OPEN" } });
    page.fireEvent.click(page.view.getByRole("button", { name: "Apply" }));

    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: "Filters 2" })));
    page.fireEvent.click(page.view.getByRole("button", { name: "Filters 2" }));
    page.fireEvent.click(page.view.getByRole("button", { name: "Reset" }));

    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: "Filters" })));
    assert.ok(
      page.calls.some(
        (call) =>
          call.includes("sport=RUNNING") && !call.includes("city=") && !call.includes("status="),
      ),
    );
  } finally {
    page.close();
  }
});

test("clearing a Community category in advanced filters clears the quick category selection", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("No Requests are listed yet.")));
    page.fireEvent.click(page.view.getByRole("button", { name: "Community" }));
    page.fireEvent.click(page.view.getByRole("button", { name: "Lost & Found" }));
    page.fireEvent.click(page.view.getByRole("button", { name: "Filters" }));
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "" },
    });
    page.fireEvent.click(page.view.getByRole("button", { name: "Apply" }));

    await page.waitFor(() =>
      assert.equal(
        page.view.getByRole("button", { name: "All" }).getAttribute("aria-pressed"),
        "true",
      ),
    );
    assert.equal(
      page.view.getByRole("button", { name: "Lost & Found" }).getAttribute("aria-pressed"),
      "false",
    );
    assert.ok(page.view.getByRole("button", { name: "Filters" }));
  } finally {
    page.close();
  }
});
