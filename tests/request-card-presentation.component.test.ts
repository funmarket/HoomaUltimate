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
    url: "http://localhost/requests",
  });
  for (const [key, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
  })) {
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
  }
  return dom;
}

const request = {
  id: "request-1",
  category: "ITEM",
  sport: "RUNNING",
  title: "Need size 43 running shoes",
  description: "Looking for used or new running shoes for evening training sessions.",
  quantityNeeded: 1,
  sizeLabel: "43",
  conditionPreference: "USED_OK",
  city: "La Marsa",
  houma: "Corniche",
  fullAddress: "12 Private Street",
  locationNote: "Meet near the public entrance",
  neededByAt: "2026-10-01T12:00:00.000Z",
  expiresAt: "2026-10-04T12:00:00.000Z",
  status: "OPEN",
  image: { source: "UPLOAD" },
  requester: {
    displayName: "Yassine K.",
    username: "yassine.k",
    photoUrl: null,
  },
};

test("Request card expands inline without exposing private address or hijacking profile navigation", async () => {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, configurable: true, writable: true });
  const { cleanup, fireEvent, render } = await import("@testing-library/react");
  const { RequestCard } = await import("../packages/frontend/src/requests/RequestCard");
  const loaded: string[] = [];
  const view = render(
    React.createElement(RequestCard, {
      item: request,
      loadImage: async (requestId: string) => {
        loaded.push(requestId);
        return "https://cdn.example.test/request.webp";
      },
    }),
  );

  try {
    const toggle = view.getByRole("button", { name: /Need size 43 running shoes/i });
    assert.equal(toggle.tagName, "BUTTON");
    assert.equal(toggle.getAttribute("aria-expanded"), "false");
    assert.equal(view.queryByRole("link", { name: "View full Request" }), null);
    assert.equal(view.queryByText("12 Private Street"), null);

    fireEvent.click(toggle);
    assert.equal(toggle.getAttribute("aria-expanded"), "true");
    assert.equal(
      view.getByRole("link", { name: "View full Request" }).getAttribute("href"),
      "/requests/request-1",
    );
    assert.equal(
      view.getByRole("link", { name: /Yassine K\./ }).getAttribute("href"),
      "/profile/yassine.k",
    );
    assert.equal(view.queryByText("12 Private Street"), null);
    assert.ok(view.getByText("Meet near the public entrance"));
    assert.deepEqual(loaded, ["request-1"]);
    assert.equal(
      (await view.findByRole("img", { name: /Need size 43 running shoes/i })).getAttribute("src"),
      "https://cdn.example.test/request.webp",
    );
  } finally {
    cleanup();
    dom.window.close();
  }
});
