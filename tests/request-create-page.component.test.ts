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

function installDom(url = "http://localhost/requests/new") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url,
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

const meResponse = {
  id: "user-1",
  presentation: { username: "coach", displayName: "Coach Amine", photoUrl: null, bio: null },
  transports: ["web"],
  platformRoles: [],
  managerCapabilities: [],
  communities: [{ id: "community-1", name: "Tunis HOOMA", slug: "tunis", role: "FOUNDER" }],
  athletesCommunities: [
    { id: "athletes-1", name: "Athletes Tunis", slug: "athletes-tunis", role: "MODERATOR" },
  ],
  moderation: {
    yellowCardCount: 0,
    isBanned: false,
    banExpiresAt: null,
    isReadOnly: false,
    readOnlyExpiresAt: null,
    isDisabled: false,
  },
  teams: [
    {
      id: "team-1",
      name: "Etoile",
      slug: "etoile",
      badgeUrl: null,
      isPlayer: true,
      responsibilities: ["COACH"],
      capabilities: [],
    },
  ],
};

const createdRequest = { id: "request-9" };

const footballNeed = {
  id: "htn-football-ball",
  slug: "football",
  label: "Football",
  kind: "PRODUCT" as const,
  allowsCustomText: false,
  sortOrder: 10,
};

const playTaxonomy = {
  sports: [
    {
      sport: "FOOTBALL",
      label: "Football",
      subcategories: [
        {
          id: "hts-football-equipment",
          slug: "equipment-gear",
          label: "Equipment & Gear",
          sortOrder: 10,
          needs: [footballNeed],
        },
      ],
    },
  ],
  community: { label: "Community" as const, subcategories: [] },
};

const athletesTaxonomy = {
  sports: requestsTaxonomy.sports,
  community: { label: "Community" as const, subcategories: [] },
};

function installApiStub(options: {
  readonly me?: unknown;
  readonly taxonomy?: unknown;
  readonly failMediaAttempts?: number;
}) {
  const calls: RecordedCall[] = [];
  let mediaAttempts = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({
      path: `${url.pathname}${url.search}`,
      method,
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body ? "<binary>" : null,
    });
    if (url.pathname === "/api/public/v1/auth/session") return json(options.me ?? null);
    if (url.pathname === "/api/public/v1/help/taxonomy") {
      return json(options.taxonomy ?? requestsTaxonomy);
    }
    if (url.pathname === "/api/v1/requests" && method === "POST") return json(createdRequest, 201);
    if (url.pathname === "/api/v1/requests/request-9/image/external" && method === "PUT") {
      mediaAttempts += 1;
      if (mediaAttempts <= (options.failMediaAttempts ?? 0)) {
        return json(
          { error: { code: "REQUEST_IMAGE_UPLOAD_FAILED", message: "Image upload failed" } },
          500,
        );
      }
      return json({
        id: "image-1",
        source: "EXTERNAL_URL",
        contentType: null,
        sizeBytes: null,
        updatedAt: "2026-09-23T13:00:00.000Z",
      });
    }
    return json(
      { error: { code: "NOT_FOUND", message: `Unexpected ${method} ${url.pathname}` } },
      404,
    );
  }) as typeof fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

async function renderCreatePage(options: {
  readonly me?: unknown;
  readonly taxonomy?: unknown;
  readonly failMediaAttempts?: number;
  readonly url?: string;
}) {
  const dom = installDom(options.url);
  const apiStub = installApiStub(options);
  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render, waitFor, within } = await import("@testing-library/react");
  const { HoomaFrontendProvider, RequestCreatePage } = await import("@hooma/frontend");
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
      React.createElement(RequestCreatePage, null),
    ),
  );
  return {
    view,
    calls: apiStub.calls,
    fireEvent,
    waitFor,
    within,
    close: () => {
      apiStub.restore();
      cleanup();
      dom.window.close();
    },
  };
}

test("a guest is sent through the current HOOMA auth flow with returnTo preserved", async () => {
  const page = await renderCreatePage({ me: null });
  try {
    await page.waitFor(() =>
      assert.ok(page.view.getByRole("link", { name: /Sign in to continue/i })),
    );
    const link = page.view.getByRole("link", { name: /Sign in to continue/i });
    assert.equal(link.getAttribute("href"), "/login?returnTo=%2Frequests%2Fnew");
    assert.equal(page.view.queryByLabelText("Title"), null);
  } finally {
    page.close();
  }
});

test("guest authentication preserves the exact projection-specific create destination", async () => {
  const cases = [
    {
      url: "http://localhost/requests/new?surface=PLAY",
      returnTo: "/requests/new?surface=PLAY",
    },
    {
      url: "http://localhost/requests/new?surface=ATHLETES",
      returnTo: "/requests/new?surface=ATHLETES",
    },
  ];

  for (const current of cases) {
    const page = await renderCreatePage({ me: null, url: current.url });
    try {
      await page.waitFor(() =>
        assert.ok(page.view.getByRole("link", { name: /Sign in to continue/i })),
      );
      assert.equal(
        page.view.getByRole("link", { name: /Sign in to continue/i }).getAttribute("href"),
        `/login?returnTo=${encodeURIComponent(current.returnTo)}`,
      );
    } finally {
      page.close();
    }
  }
});

test("a signed-in member can publish a Request and is linked to it", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: "Sport" })));
    assert.equal(page.view.queryByRole("button", { name: "All Requests" }), null);
    page.fireEvent.click(page.view.getByRole("button", { name: "Sport" }));
    page.fireEvent.change(page.view.getByLabelText("Sport"), {
      target: { value: "RUNNING" },
    });
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-running-footwear" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-running-shoes" },
    });

    // Publisher choices come from the current MeResponse only.
    assert.ok(page.view.getByRole("option", { name: /Team · Etoile/ }));
    assert.ok(page.view.getByRole("option", { name: /HOOMA · Tunis HOOMA/ }));
    assert.ok(page.view.getByRole("option", { name: /Athletes · Athletes Tunis/ }));
    assert.ok(page.view.getByRole("option", { name: /Everyone/ }));

    page.fireEvent.change(page.view.getByLabelText("Title"), {
      target: { value: "Need size 43 running shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Description"), {
      target: { value: "Looking for used or new running shoes for training sessions." },
    });
    page.fireEvent.change(page.view.getByLabelText("Full address"), {
      target: { value: "12 Avenue Habib Bourguiba" },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.getByRole("link", { name: /View Request/i })));

    const post = page.calls.find((call) => call.method === "POST");
    assert.ok(
      post,
      `expected a POST, saw ${page.calls.map((c) => `${c.method} ${c.path}`).join(" | ")}`,
    );
    assert.equal(post.path, "/api/v1/requests");
    assert.deepEqual(post.body, {
      publisher: {},
      audience: { scope: "PUBLIC" },
      requestType: "SPORT",
      sport: "RUNNING",
      subcategoryId: "hts-running-footwear",
      needId: "htn-running-shoes",
      title: "Need size 43 running shoes",
      description: "Looking for used or new running shoes for training sessions.",
      fullAddress: "12 Avenue Habib Bourguiba",
    });

    const viewLink = page.view.getByRole("link", { name: /View Request/i });
    assert.equal(viewLink.getAttribute("href"), "/requests/request-9");
  } finally {
    page.close();
  }
});

test("a signed-in member can publish a Community Request without Sport", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: "Community" })));
    page.fireEvent.click(page.view.getByRole("button", { name: "Community" }));
    assert.equal(page.view.queryByLabelText("Sport"), null);
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-community-lost-found" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-community-lost-item" },
    });
    page.fireEvent.change(page.view.getByLabelText("Title"), {
      target: { value: "Lost wallet near the station" },
    });
    page.fireEvent.change(page.view.getByLabelText("Description"), {
      target: { value: "I lost a wallet nearby and need help checking the area." },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.getByRole("link", { name: /View Request/i })));
    const post = page.calls.find((call) => call.method === "POST");
    assert.ok(post);
    assert.deepEqual(post.body, {
      publisher: {},
      audience: { scope: "PUBLIC" },
      requestType: "COMMUNITY",
      subcategoryId: "hts-community-lost-found",
      needId: "htn-community-lost-item",
      title: "Lost wallet near the station",
      description: "I lost a wallet nearby and need help checking the area.",
    });
  } finally {
    page.close();
  }
});

test("PLAY create explicitly submits the locked SPORT and FOOTBALL context", async () => {
  const page = await renderCreatePage({
    me: meResponse,
    taxonomy: playTaxonomy,
    url: "http://localhost/requests/new?surface=PLAY",
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Football Request")));
    assert.ok(page.view.getByText("Create a Football Request for Play."));
    assert.equal(page.view.queryByRole("button", { name: "Community" }), null);
    assert.equal(page.view.queryByLabelText("Sport"), null);
    assert.ok(page.calls.some((call) => call.path === "/api/public/v1/help/taxonomy?surface=PLAY"));

    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-football-equipment" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-football-ball" },
    });
    page.fireEvent.change(page.view.getByLabelText("Title"), {
      target: { value: "Need a match football" },
    });
    page.fireEvent.change(page.view.getByLabelText("Description"), {
      target: { value: "Our group needs a football for the next training session." },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.getByRole("link", { name: "Back to Play" })));
    const post = page.calls.find((call) => call.method === "POST");
    assert.ok(post);
    assert.deepEqual(post.body, {
      publisher: {},
      audience: { scope: "PUBLIC" },
      requestType: "SPORT",
      sport: "FOOTBALL",
      subcategoryId: "hts-football-equipment",
      needId: "htn-football-ball",
      title: "Need a match football",
      description: "Our group needs a football for the next training session.",
    });
    assert.equal(
      page.view.getByRole("link", { name: "Back to Play" }).getAttribute("href"),
      "/play",
    );
  } finally {
    page.close();
  }
});

test("ATHLETES create submits SPORT with a taxonomy-supplied non-Football sport", async () => {
  const page = await renderCreatePage({
    me: meResponse,
    taxonomy: athletesTaxonomy,
    url: "http://localhost/requests/new?surface=ATHLETES",
  });
  try {
    await page.waitFor(() => assert.ok(page.view.getByText("Athletes Sport Request")));
    assert.ok(page.view.getByText("Create a sport Request with the Athletes taxonomy."));
    assert.equal(page.view.queryByRole("button", { name: "Community" }), null);
    assert.equal(page.view.queryByRole("option", { name: "Football" }), null);
    assert.ok(page.view.getByRole("option", { name: "Running" }));

    page.fireEvent.change(page.view.getByLabelText("Sport"), {
      target: { value: "RUNNING" },
    });
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-running-footwear" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-running-shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Title"), {
      target: { value: "Need running shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Description"), {
      target: { value: "I need running shoes for the next community training session." },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.getByRole("link", { name: "Back to Athletes" })));
    const post = page.calls.find((call) => call.method === "POST");
    assert.ok(post);
    assert.equal((post.body as { requestType?: string }).requestType, "SPORT");
    assert.equal((post.body as { sport?: string }).sport, "RUNNING");
    assert.equal(
      page.view.getByRole("link", { name: "Back to Athletes" }).getAttribute("href"),
      "/athletes?tab=requests",
    );
  } finally {
    page.close();
  }
});

test("taxonomy progression clears invalid descendants and keeps product fields conditional", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: "Sport" })));
    assert.equal(page.view.queryByText("Publishing"), null);
    assert.equal(page.view.queryByLabelText("Category"), null);
    assert.equal(page.view.queryByLabelText("Specific need"), null);

    page.fireEvent.click(page.view.getByRole("button", { name: "Sport" }));
    assert.equal(page.view.queryByLabelText("Category"), null);
    page.fireEvent.change(page.view.getByLabelText("Sport"), {
      target: { value: "RUNNING" },
    });
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-running-footwear" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-running-shoes" },
    });
    assert.ok(page.view.getByText("Publishing"));
    assert.ok(page.view.getByLabelText("Quantity"));

    page.fireEvent.click(page.view.getByRole("button", { name: "Community" }));
    assert.equal(page.view.queryByLabelText("Sport"), null);
    assert.equal((page.view.getByLabelText("Category") as HTMLSelectElement).value, "");
    assert.equal(page.view.queryByLabelText("Specific need"), null);
    assert.equal(page.view.queryByLabelText("Quantity"), null);
    assert.equal(page.view.queryByText("Publishing"), null);

    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-community-lost-found" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-community-lost-item" },
    });
    assert.ok(page.view.getByText("Publishing"));
    assert.equal(page.view.queryByLabelText("Quantity"), null);
  } finally {
    page.close();
  }
});

test("governed custom Need text appears only when the selected Need allows it", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: "Community" })));
    page.fireEvent.click(page.view.getByRole("button", { name: "Community" }));
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-community-lost-found" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-community-lost-found-other" },
    });
    const custom = page.view.getByLabelText("Describe the need");
    assert.equal(custom.hasAttribute("required"), true);
    assert.equal(page.view.queryByText("Publishing"), null);

    page.fireEvent.change(custom, { target: { value: "Help identify a found kit bag" } });
    assert.ok(page.view.getByText("Publishing"));

    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-community-lost-item" },
    });
    assert.equal(page.view.queryByLabelText("Describe the need"), null);
  } finally {
    page.close();
  }
});

test("publisher and audience selections retain their canonical mappings", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: "Community" })));
    page.fireEvent.click(page.view.getByRole("button", { name: "Community" }));
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-community-lost-found" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-community-lost-item" },
    });
    page.fireEvent.change(page.view.getByLabelText("Publish as"), {
      target: { value: "team:team-1" },
    });
    page.fireEvent.change(page.view.getByLabelText("Audience"), {
      target: { value: "athletes:athletes-1" },
    });
    page.fireEvent.change(page.view.getByLabelText("Title"), {
      target: { value: "Lost training bibs" },
    });
    page.fireEvent.change(page.view.getByLabelText("Description"), {
      target: { value: "Our team lost a bag of training bibs near the field." },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.getByRole("link", { name: "Back to Requests" })));
    const post = page.calls.find((call) => call.method === "POST");
    assert.ok(post);
    assert.deepEqual((post.body as { publisher?: unknown }).publisher, {
      publisherTeamId: "team-1",
    });
    assert.deepEqual((post.body as { audience?: unknown }).audience, {
      scope: "ATHLETES_COMMUNITY",
      athletesCommunityId: "athletes-1",
    });
    assert.equal(
      page.view.getByRole("link", { name: "Back to Requests" }).getAttribute("href"),
      "/requests",
    );
  } finally {
    page.close();
  }
});

test("invalid input is rejected by the shared contract without any write", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: "Sport" })));
    page.fireEvent.click(page.view.getByRole("button", { name: "Sport" }));
    page.fireEvent.change(page.view.getByLabelText("Sport"), {
      target: { value: "RUNNING" },
    });
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-running-footwear" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-running-shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Title"), { target: { value: "ok" } });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.container.querySelector(".request-error")));
    assert.equal(page.calls.filter((call) => call.method === "POST").length, 0);
    assert.equal(page.view.queryByRole("link", { name: /View Request/i }), null);
  } finally {
    page.close();
  }
});

test("a created Request attaches an external image only after creation", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: "Sport" })));
    page.fireEvent.click(page.view.getByRole("button", { name: "Sport" }));
    page.fireEvent.change(page.view.getByLabelText("Sport"), {
      target: { value: "RUNNING" },
    });
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-running-footwear" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-running-shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Title"), {
      target: { value: "Need size 43 running shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Description"), {
      target: { value: "Looking for used or new running shoes for training sessions." },
    });
    page.fireEvent.change(page.view.getByLabelText("Image URL"), {
      target: { value: "https://images.example.test/request.jpg" },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() => assert.ok(page.view.getByRole("link", { name: /View Request/i })));

    const writes = page.calls.filter((call) => call.method === "POST" || call.method === "PUT");
    assert.equal(writes[0]?.path, "/api/v1/requests");
    assert.equal(writes[1]?.path, "/api/v1/requests/request-9/image/external");
    assert.deepEqual(writes[1]?.body, { url: "https://images.example.test/request.jpg" });
  } finally {
    page.close();
  }
});

test("image failure keeps the created Request and retry attaches to the original Request", async () => {
  const page = await renderCreatePage({ me: meResponse, failMediaAttempts: 1 });
  try {
    await page.waitFor(() => assert.ok(page.view.getByRole("button", { name: "Sport" })));
    page.fireEvent.click(page.view.getByRole("button", { name: "Sport" }));
    page.fireEvent.change(page.view.getByLabelText("Sport"), {
      target: { value: "RUNNING" },
    });
    page.fireEvent.change(page.view.getByLabelText("Category"), {
      target: { value: "hts-running-footwear" },
    });
    page.fireEvent.change(page.view.getByLabelText("Specific need"), {
      target: { value: "htn-running-shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Title"), {
      target: { value: "Need size 43 running shoes" },
    });
    page.fireEvent.change(page.view.getByLabelText("Description"), {
      target: { value: "Looking for used or new running shoes for training sessions." },
    });
    page.fireEvent.change(page.view.getByLabelText("Image URL"), {
      target: { value: "https://images.example.test/request.jpg" },
    });
    page.fireEvent.submit(page.view.getByRole("button", { name: /Publish Request/i }));

    await page.waitFor(() =>
      assert.ok(page.view.getByText(/Request created, but the image could not be uploaded/i)),
    );
    assert.ok(page.view.getByRole("link", { name: /View Request/i }));
    page.fireEvent.click(page.view.getByRole("button", { name: /Retry image/i }));
    await page.waitFor(() => assert.equal(page.view.queryByText(/could not be uploaded/i), null));
    assert.equal(
      page.calls.filter((call) => call.method === "POST").length,
      1,
      "media retry state must not recreate the Request",
    );
    assert.deepEqual(
      page.calls.filter((call) => call.method === "PUT").map((call) => call.path),
      ["/api/v1/requests/request-9/image/external", "/api/v1/requests/request-9/image/external"],
    );
  } finally {
    page.close();
  }
});
