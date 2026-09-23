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

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/requests/new",
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

function installApiStub(options: { readonly me?: unknown }) {
  const calls: RecordedCall[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    calls.push({
      path: `${url.pathname}${url.search}`,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : null,
    });
    if (url.pathname === "/api/public/v1/auth/session") return json(options.me ?? null);
    if (url.pathname === "/api/public/v1/help/taxonomy") return json(requestsTaxonomy);
    if (url.pathname === "/api/v1/requests" && method === "POST") return json(createdRequest, 201);
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

async function renderCreatePage(options: { readonly me?: unknown }) {
  const dom = installDom();
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

test("a signed-in member can publish a Request and is linked to it", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByLabelText("Title")));

    // Publisher choices come from the current MeResponse only.
    assert.ok(page.view.getByRole("option", { name: /Team · Etoile/ }));
    assert.ok(page.view.getByRole("option", { name: /HOOMA · Tunis HOOMA/ }));
    assert.ok(page.view.getByRole("option", { name: /Athletes · Athletes Tunis/ }));
    assert.ok(page.view.getByRole("option", { name: /Everyone/ }));

    page.fireEvent.change(page.view.getByLabelText("Request Type"), {
      target: { value: "SPORT" },
    });
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
    await page.waitFor(() => assert.ok(page.view.getByLabelText("Request Type")));
    page.fireEvent.change(page.view.getByLabelText("Request Type"), {
      target: { value: "COMMUNITY" },
    });
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

test("invalid input is rejected by the shared contract without any write", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByLabelText("Title")));
    page.fireEvent.change(page.view.getByLabelText("Request Type"), {
      target: { value: "SPORT" },
    });
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

test("signed-in Request creation exposes an optional Image URL control", async () => {
  const page = await renderCreatePage({ me: meResponse });
  try {
    await page.waitFor(() => assert.ok(page.view.getByLabelText("Title")));
    assert.ok(page.view.getByLabelText("Image URL"));
  } finally {
    page.close();
  }
});
