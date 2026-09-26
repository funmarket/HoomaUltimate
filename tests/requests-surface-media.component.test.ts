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

const requestWithImage = {
  id: "request-media-1",
  category: "ITEM",
  sport: "RUNNING",
  title: "Need training shoes",
  description: "Looking for a pair for evening training.",
  city: "Tunis",
  status: "OPEN",
  image: { source: "UPLOAD" },
  requester: null,
};

function installDom(url: string) {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url });
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Event: dom.window.Event,
    FormData: dom.window.FormData,
  })) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  return dom;
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

async function renderSurface(surface: "REQUESTS" | "PLAY" | "ATHLETES", memberViewer: boolean) {
  const dom = installDom(`http://localhost/${surface.toLowerCase()}`);
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    if (url.pathname === "/api/public/v1/auth/session") {
      return json(memberViewer ? { id: "user-1" } : null);
    }
    if (url.pathname === "/api/public/v1/help/taxonomy") return json(requestsTaxonomy);
    if (url.pathname === "/api/public/v1/requests" || url.pathname === "/api/v1/requests") {
      return json({ items: [requestWithImage], nextCursor: null });
    }
    if (url.pathname.endsWith("/image/delivery")) {
      return json({ contentUrl: `https://cdn.example.test/${surface.toLowerCase()}.webp` });
    }
    return json({ error: { code: "NOT_FOUND", message: `Unexpected ${url.pathname}` } });
  }) as typeof fetch;

  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("../packages/frontend/src/context.js");
  const Component =
    surface === "REQUESTS"
      ? (await import("../packages/frontend/src/requests/RequestsPage.js")).RequestsPage
      : surface === "PLAY"
        ? (await import("../packages/frontend/src/events/PlayRequestsPane.js")).PlayRequestsPane
        : (await import("../packages/frontend/src/athletes/AthletesRequestsPane.js"))
            .AthletesRequestsPane;
  const view = render(
    React.createElement(
      HoomaFrontendProvider,
      { transport: { baseUrl: "http://api.test" } },
      React.createElement(Component),
    ),
  );

  return {
    calls,
    view,
    waitFor,
    close() {
      globalThis.fetch = originalFetch;
      cleanup();
      dom.window.close();
    },
  };
}

test("standalone Requests resolves public card media through the canonical delivery route", async () => {
  const page = await renderSurface("REQUESTS", false);
  try {
    const image = await page.view.findByRole("img", { name: /Need training shoes/i });
    assert.equal(image.getAttribute("src"), "https://cdn.example.test/requests.webp");
    assert.ok(page.calls.includes("GET /api/public/v1/requests/request-media-1/image/delivery"));
    assert.equal(
      page.calls.some((call) => call.includes("cdn.example.test")),
      false,
    );
  } finally {
    page.close();
  }
});

test("Play resolves member card media while preserving the PLAY projection", async () => {
  const page = await renderSurface("PLAY", true);
  try {
    const image = await page.view.findByRole("img", { name: /Need training shoes/i });
    assert.equal(image.getAttribute("src"), "https://cdn.example.test/play.webp");
    assert.ok(page.calls.includes("GET /api/v1/requests?surface=PLAY"));
    assert.ok(page.calls.includes("GET /api/v1/requests/request-media-1/image/delivery"));
    assert.equal(
      page.calls.some((call) => call.includes("cdn.example.test")),
      false,
    );
  } finally {
    page.close();
  }
});

test("Athletes resolves member card media while preserving its constrained projection", async () => {
  const page = await renderSurface("ATHLETES", true);
  try {
    const image = await page.view.findByRole("img", { name: /Need training shoes/i });
    assert.equal(image.getAttribute("src"), "https://cdn.example.test/athletes.webp");
    assert.ok(page.calls.includes("GET /api/v1/requests?requestType=SPORT&surface=ATHLETES"));
    assert.ok(page.calls.includes("GET /api/v1/requests/request-media-1/image/delivery"));
    assert.ok(page.calls.includes("GET /api/public/v1/help/taxonomy?surface=ATHLETES"));
    assert.equal(page.view.queryByRole("button", { name: "Community" }), null);
    assert.equal(page.view.queryByRole("button", { name: "Football" }), null);
    assert.equal(
      page.calls.some((call) => call.includes("cdn.example.test")),
      false,
    );
  } finally {
    page.close();
  }
});
