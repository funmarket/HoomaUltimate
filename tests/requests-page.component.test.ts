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
  readonly publicNextCursor?: string | null;
  readonly publicPageTwoItems?: readonly unknown[];
  readonly memberItems?: readonly unknown[];
};

/**
 * The canonical shared taxonomy the Requests surfaces load. Both roots are
 * served: `sports` for SPORT requests and `community` for COMMUNITY requests.
 */
const taxonomyFixture = {
  sports: [
    {
      sport: "RUNNING",
      label: "Running",
      subcategories: [
        {
          id: "hts-running-gear",
          requestType: "SPORT",
          slug: "gear",
          label: "Gear",
          sortOrder: 10,
          needs: [
            {
              id: "htn-running-shoes",
              slug: "shoes",
              label: "Running shoes",
              kind: "PRODUCT",
              allowsCustomText: false,
              sortOrder: 10,
            },
          ],
        },
      ],
    },
  ],
  community: [
    {
      id: "hts-community-lost-found",
      requestType: "COMMUNITY",
      slug: "lost-found",
      label: "Lost & Found",
      sortOrder: 10,
      needs: [
        {
          id: "htn-community-lost-item",
          slug: "lost-item",
          label: "Lost item",
          kind: "COMMUNITY_SUPPORT",
          allowsCustomText: false,
          sortOrder: 10,
        },
        {
          id: "htn-community-other",
          slug: "other",
          label: "Other",
          kind: "COMMUNITY_SUPPORT",
          allowsCustomText: true,
          sortOrder: 90,
        },
      ],
    },
  ],
};

function installApiStub(options: StubOptions) {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const key = `${init?.method ?? "GET"} ${url.pathname}${url.search}`;
    calls.push(key);
    if (url.pathname === "/api/public/v1/auth/session") return json(options.me ?? null);
    if (url.pathname === "/api/public/v1/help/taxonomy") return json(taxonomyFixture);
    if (url.pathname === "/api/public/v1/requests") {
      if (url.searchParams.get("cursor")) {
        return json({ items: options.publicPageTwoItems ?? [], nextCursor: null });
      }
      return json({
        items: options.publicItems ?? [],
        nextCursor: options.publicNextCursor ?? null,
      });
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
  requester: {
    userId: "user-2",
    username: "sami",
    displayName: "Sami B",
    photoUrl: null,
  },
  publisherCommunityId: null,
  publisherTeamId: null,
  publisherAthletesCommunityId: null,
  audienceScope: "PUBLIC",
  audienceCommunityId: null,
  audienceAthletesCommunityId: null,
  requestType: "SPORT",
  category: "ITEM",
  itemKind: "FOOTWEAR",
  sport: "RUNNING",
  subcategoryId: null,
  needId: null,
  customNeed: null,
  taxonomy: null,
  title: "Need size 43 running shoes",
  description: "Looking for used or new running shoes for training.",
  quantityNeeded: 1,
  sizeLabel: "43",
  conditionPreference: "USED_OK",
  placeId: null,
  city: "La Marsa",
  houma: null,
  fullAddress: null,
  locationNote: null,
  imageUrl: null,
  hasUploadedImage: false,
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
  const { HoomaFrontendProvider, RequestsPage } = await import("@hooma/frontend");
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

/**
 * The locked card renders the headline as a two-weight split (accent word plus
 * the remainder), so an exact whole-string `getByText` can never match: the
 * fitted text lives in two child elements. Read the headline element instead.
 */
function requestTitles(view: { container: HTMLElement }): string[] {
  return Array.from(view.container.querySelectorAll(".request-card__title")).map((node) =>
    (node.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
}

test("anonymous /requests loads the real public Requests feed", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [publicRequest] });
  try {
    await page.waitFor(() =>
      assert.ok(
        requestTitles(page.view).includes("Need size 43 running shoes"),
        `titles=${JSON.stringify(requestTitles(page.view))} calls=${page.calls.join(" | ")} body=${(page.view.container.textContent ?? "").slice(0, 300)}`,
      ),
    );
    assert.equal(page.view.queryByText("No Requests are listed yet."), null);
    assert.ok(page.view.getByRole("link", { name: /Create request/i }));
    assert.ok(page.view.getByRole("link", { name: /FundMe/i }));
    assert.equal(page.view.queryByText("Donations"), null);
    const card = page.view.getByRole("link", { name: /Need size 43 running shoes/i });
    assert.equal(card.getAttribute("href"), "/requests/request-1");
    const cardView = page.within(card);
    assert.ok(cardView.getByText("Item"));
    assert.ok(cardView.getByText("Open"));
    assert.ok(cardView.getByText("La Marsa"));
    assert.deepEqual(
      page.calls.filter((call) => call.includes("/requests")),
      ["GET /api/public/v1/requests?surface=REQUESTS"],
    );
  } finally {
    page.close();
  }
});

test("signed-in visitor uses the member list endpoint and an empty result is a legitimate state", async () => {
  const page = await renderRequestsPage({ me: meResponse, memberItems: [] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("No Requests match these filters.")));
    assert.deepEqual(
      page.calls.filter((call) => call.includes("/requests")),
      ["GET /api/v1/requests?surface=REQUESTS"],
    );
    assert.equal(page.view.queryByText("No Requests are listed yet."), null);
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
    await page.waitFor(() =>
      assert.ok(requestTitles(page.view).includes("Need size 43 running shoes")),
    );
    page.fireEvent.click(page.view.getByRole("button", { name: /Load more/i }));
    await page.waitFor(() => assert.ok(requestTitles(page.view).includes("Need training cones")));
    assert.ok(requestTitles(page.view).includes("Need size 43 running shoes"));
    assert.ok(
      page.calls.includes("GET /api/public/v1/requests?surface=REQUESTS&cursor=cursor-2"),
      `expected cursor request, saw ${page.calls.join(" | ")}`,
    );
  } finally {
    page.close();
  }
});

test("City filter debounces list reloads and does not repeat identity lookup", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("No Requests match these filters.")));
    page.calls.length = 0;

    const city = page.view.getByLabelText("City");
    page.fireEvent.change(city, { target: { value: "T" } });
    page.fireEvent.change(city, { target: { value: "Tu" } });
    page.fireEvent.change(city, { target: { value: "Tunis" } });

    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(page.calls.filter((call) => call.includes("/requests")).length, 0);

    await page.waitFor(
      () => {
        assert.deepEqual(
          page.calls.filter((call) => call.includes("/requests")),
          ["GET /api/public/v1/requests?surface=REQUESTS&city=Tunis"],
        );
      },
      { timeout: 1000 },
    );
    assert.equal(page.calls.filter((call) => call.includes("/auth/session")).length, 0);
  } finally {
    page.close();
  }
});

test("filters call the canonical Sport root query model", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [publicRequest] });
  try {
    await page.waitFor(() =>
      assert.ok(requestTitles(page.view).includes("Need size 43 running shoes")),
    );
    // The corrected taxonomy is root-first: Request type selects the Sport branch
    // before a sport-specific taxonomy choice is available.
    page.fireEvent.change(page.view.getByLabelText("Request type"), {
      target: { value: "SPORT" },
    });
    page.fireEvent.change(page.view.getByLabelText("Sport"), { target: { value: "RUNNING" } });
    page.fireEvent.change(page.view.getByLabelText("City"), { target: { value: "La Marsa" } });
    await page.waitFor(() =>
      assert.ok(
        page.calls.some(
          (call) =>
            call.includes("requestType=SPORT") &&
            call.includes("sport=RUNNING") &&
            call.includes("city=La+Marsa"),
        ),
        `expected filtered public list call, saw ${page.calls.join(" | ")}`,
      ),
    );
  } finally {
    page.close();
  }
});

test("Community root filters without requiring a sport", async () => {
  const page = await renderRequestsPage({ me: null, publicItems: [] });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("No Requests match these filters.")));
    page.calls.length = 0;

    page.fireEvent.change(page.view.getByLabelText("Request type"), {
      target: { value: "COMMUNITY" },
    });
    page.fireEvent.change(page.view.getByLabelText("Subcategory"), {
      target: { value: "hts-community-lost-found" },
    });

    await page.waitFor(() =>
      assert.ok(
        page.calls.some(
          (call) =>
            call.includes("requestType=COMMUNITY") &&
            call.includes("subcategoryId=hts-community-lost-found") &&
            !call.includes("sport="),
        ),
        `expected Community filter without sport, saw ${page.calls.join(" | ")}`,
      ),
    );
    assert.equal(page.view.queryByLabelText("Sport"), null);
  } finally {
    page.close();
  }
});
