import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { JSDOM, VirtualConsole } from "jsdom";
import React from "react";

const virtualConsole = new VirtualConsole();
virtualConsole.on("jsdomError", (error) => {
  // Modified/middle clicks intentionally remain native; JSDOM does not implement navigation.
  if (!error.message.includes("navigation")) console.error(error);
});
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
  virtualConsole,
});
for (const key of ["window", "document", "HTMLElement", "Element", "Node", "navigator"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
    writable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, "React", { value: React, configurable: true });

const { cleanup, fireEvent, render } = await import("@testing-library/react");
const { HomeGatewayGrid } = await import("../packages/ui/src/home/HomeGatewayGrid.tsx");

afterEach(cleanup);

test("Home Gateway keeps real anchors and intercepts only an unmodified left click", () => {
  const navigations: string[] = [];
  const view = render(
    React.createElement(HomeGatewayGrid, { onNavigate: (href: string) => navigations.push(href) }),
  );
  const link = view.getByRole("link", { name: "Ride" });
  assert.equal(link.getAttribute("href"), "/rides");

  const ordinaryClick = new dom.window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
  });
  fireEvent(link, ordinaryClick);
  assert.equal(ordinaryClick.defaultPrevented, true);
  assert.deepEqual(navigations, ["/rides"]);

  const modifiedClick = new dom.window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 0,
    ctrlKey: true,
  });
  fireEvent(link, modifiedClick);
  assert.equal(modifiedClick.defaultPrevented, false);
  modifiedClick.preventDefault();
  const middleClick = new dom.window.MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    button: 1,
  });
  fireEvent(link, middleClick);
  assert.equal(middleClick.defaultPrevented, false);
  middleClick.preventDefault();
  assert.deepEqual(navigations, ["/rides"]);
});
