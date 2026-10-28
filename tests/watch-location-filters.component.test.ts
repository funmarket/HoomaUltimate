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

test("Watch location filters retain accessible names when phone visual labels are hidden", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/watch",
  });
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousReact = Object.getOwnPropertyDescriptor(globalThis, "React");
  Object.defineProperty(globalThis, "window", { value: dom.window, configurable: true });
  try {
    const React = await import("react");
    Object.defineProperty(globalThis, "React", { value: React, configurable: true });
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { getByRole } = await import("@testing-library/dom");
    const { WatchPage } = await import("../packages/frontend/src/watch/WatchPage");
    const { HoomaFrontendProvider } = await import("../packages/frontend/src/context");
    dom.window.document.body.innerHTML = renderToStaticMarkup(
      React.createElement(HoomaFrontendProvider, {
        transport: { baseUrl: "http://localhost" },
        children: React.createElement(WatchPage),
      }),
    );
    // Phone presentation hides the visible captions. Names must survive that state.
    for (const caption of dom.window.document.querySelectorAll(
      ".watch-location-filters label > span",
    )) {
      caption.setAttribute("hidden", "");
    }
    for (const [name, option] of [
      ["City", "All cities"],
      ["Houma", "All Houmas"],
    ]) {
      const select = getByRole(dom.window.document.body, "combobox", { name });
      assert.equal((select as HTMLSelectElement).value, "");
      assert.equal(getByRole(select, "option", { selected: true }).textContent, option);
    }
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousReact) Object.defineProperty(globalThis, "React", previousReact);
    else Reflect.deleteProperty(globalThis, "React");
    dom.window.close();
  }
});
