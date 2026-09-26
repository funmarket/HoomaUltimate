import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";

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

test("Help tabs use client-side routing while retaining valid hrefs", async () => {
  const dom = installDom();
  const React = await import("react");
  Object.defineProperty(globalThis, "React", { value: React, configurable: true, writable: true });
  const { cleanup, fireEvent, render } = await import("@testing-library/react");
  const { MemoryRouter, useLocation } = await import("react-router-dom");
  const { HelpTabs } = await import("../packages/frontend/src/requests/HelpTabs");

  function LocationProbe() {
    return React.createElement("output", { "data-testid": "location" }, useLocation().pathname);
  }

  const view = render(
    React.createElement(
      MemoryRouter,
      { initialEntries: ["/requests"] },
      React.createElement(
        React.Fragment,
        null,
        React.createElement(HelpTabs, { tab: "requests" }),
        React.createElement(LocationProbe),
      ),
    ),
  );

  try {
    for (const [name, href] of [
      ["FundMe", "/requests/fundme"],
      ["Donations", "/requests/donations"],
      ["Requests", "/requests"],
    ] as const) {
      const link = view.getByRole("link", { name: new RegExp(name, "i") });
      assert.equal(link.getAttribute("href"), href);
      fireEvent.click(link);
      assert.equal(view.getByTestId("location").textContent, href);
    }
  } finally {
    cleanup();
    dom.window.close();
  }
});
