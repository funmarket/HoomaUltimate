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

async function exerciseSurfaceSearch(surface: "PLAY" | "ATHLETES") {
  const dom = installDom(`http://localhost/${surface.toLowerCase()}`);
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);
    if (url.pathname === "/api/public/v1/auth/session") return json(null);
    if (url.pathname === "/api/public/v1/help/taxonomy") return json(requestsTaxonomy);
    if (url.pathname === "/api/public/v1/requests") {
      return json({ items: [], nextCursor: null });
    }
    return json({ error: { code: "NOT_FOUND", message: `Unexpected ${url.pathname}` } });
  }) as typeof fetch;

  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, writable: true, configurable: true });
  const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
  const { HoomaFrontendProvider } = await import("../packages/frontend/src/context.js");
  const Component =
    surface === "PLAY"
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

  try {
    await waitFor(() => assert.ok(view.getByText("No Requests are listed yet.")));
    calls.length = 0;
    fireEvent.change(view.getByLabelText("Search Requests"), {
      target: { value: "racket partner" },
    });
    await waitFor(
      () => {
        const expected =
          surface === "ATHLETES"
            ? "GET /api/public/v1/requests?requestType=SPORT&surface=ATHLETES&q=racket+partner"
            : "GET /api/public/v1/requests?surface=PLAY&q=racket+partner";
        assert.deepEqual(
          calls.filter((call) => call.includes("/requests")),
          [expected],
        );
      },
      { timeout: 1000 },
    );
  } finally {
    globalThis.fetch = originalFetch;
    cleanup();
    dom.window.close();
  }
}

test("Play search stays inside the canonical PLAY Requests projection", async () => {
  await exerciseSurfaceSearch("PLAY");
});

test("Athletes search keeps the canonical SPORT-only ATHLETES query", async () => {
  await exerciseSurfaceSearch("ATHLETES");
});
