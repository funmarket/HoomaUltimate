import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test, { afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement as h } from "react";
import { MemoryRouter } from "react-router-dom";
import { HoomaFrontendProvider } from "../packages/frontend/dist/context.js";
import { AthletesPage } from "../packages/frontend/dist/athletes/AthletesPages.js";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "http://localhost",
});
for (const key of ["window", "document", "HTMLElement", "HTMLInputElement", "FormData"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
    writable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, fireEvent, waitFor, cleanup, configure } = await import("@testing-library/react");
configure({ asyncUtilTimeout: 10000 });
const style = document.createElement("style");
style.textContent = readFileSync("packages/frontend/src/athletes/athletes.css", "utf8");
document.head.append(style);
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
const title = "Move together. Train together.";
const firstUrl = "https://media.example.test/hero-a.webp";
const secondUrl = "https://media.example.test/hero-b.webp";
const json = (body) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
function mount(delivery, onCreate = () => {}) {
  globalThis.fetch = async (input) => {
    const pathname = new URL(input).pathname;
    if (pathname.endsWith("/hero/delivery")) return delivery();
    if (pathname.endsWith("/help/taxonomy")) {
      return json({ sports: [], community: { label: "Community", subcategories: [] } });
    }
    return json({ items: [], nextCursor: null });
  };
  const tree = (baseUrl) =>
    h(
      MemoryRouter,
      null,
      h(
        HoomaFrontendProvider,
        { transport: { baseUrl } },
        h(AthletesPage, { onCreateCommunity: onCreate }),
      ),
    );
  const view = render(tree("https://api.example.test"));
  return { view, reload: () => view.rerender(tree("https://api-next.example.test")) };
}
const headingStyle = (view) =>
  dom.window.getComputedStyle(view.getByRole("heading", { name: title }));
async function fallback(view) {
  await waitFor(() => assert.equal(headingStyle(view).position, "static"));
  assert.equal(headingStyle(view).whiteSpace, "normal");
  assert.equal(view.getAllByRole("heading", { name: title }).length, 1);
  assert.equal(view.container.querySelector(".athletes-hero__banner"), null);
}

test("delivery failure reveals the existing heading without disabling CTA or tabs", async () => {
  let created = 0;
  const { view } = mount(
    async () => {
      throw new Error("delivery unavailable");
    },
    () => created++,
  );
  await fallback(view);
  fireEvent.click(view.getByRole("button", { name: /Create community/ }));
  assert.equal(created, 1);
  fireEvent.click(view.getByRole("link", { name: "Requests" }));
  assert.equal(view.getByRole("link", { name: "Requests" }).getAttribute("aria-current"), "page");
});

for (const [name, body] of [
  ["empty URL", { contentUrl: "" }],
  ["blank URL", { contentUrl: "   " }],
  ["missing URL", {}],
]) {
  test(`${name} reveals the existing semantic heading`, async () => {
    const { view } = mount(async () => json(body));
    await fallback(view);
  });
}

test("pending delivery and image loading keep the single heading clipped until artwork loads", async () => {
  let deliver;
  const response = new Promise((resolve) => {
    deliver = resolve;
  });
  const { view } = mount(() => response);
  assert.equal(
    view.container.querySelector(".athletes-hero--hub").dataset.mediaState,
    "delivery-pending",
  );
  assert.equal(headingStyle(view).position, "absolute");
  deliver(json({ contentUrl: firstUrl }));
  await waitFor(() => assert.ok(view.container.querySelector("img.athletes-hero__banner")));
  const image = view.container.querySelector("img.athletes-hero__banner");
  assert.equal(image.src, firstUrl);
  assert.equal(
    view.container.querySelector(".athletes-hero--hub").dataset.mediaState,
    "image-loading",
  );
  fireEvent.load(image);
  assert.equal(
    view.container.querySelector(".athletes-hero--hub").dataset.mediaState,
    "image-loaded",
  );
  assert.equal(headingStyle(view).position, "absolute");
  assert.equal(image.getAttribute("alt"), "");
  assert.equal(image.getAttribute("aria-hidden"), "true");
  assert.equal(view.getAllByRole("heading", { name: title }).length, 1);
});

test("image failure reveals the heading and a later delivery restores artwork without stale errors", async () => {
  let url = firstUrl;
  const { view, reload } = mount(async () => json({ contentUrl: url }));
  await waitFor(() => assert.ok(view.container.querySelector("img.athletes-hero__banner")));
  const oldImage = view.container.querySelector("img.athletes-hero__banner");
  fireEvent.error(oldImage);
  await fallback(view);
  url = secondUrl;
  reload();
  await waitFor(() =>
    assert.equal(view.container.querySelector("img.athletes-hero__banner")?.src, secondUrl),
  );
  const newImage = view.container.querySelector("img.athletes-hero__banner");
  fireEvent.load(newImage);
  fireEvent.error(oldImage);
  fireEvent.error(newImage);
  assert.equal(
    view.container.querySelector(".athletes-hero--hub").dataset.mediaState,
    "image-loaded",
  );
  assert.equal(view.container.querySelector("img.athletes-hero__banner"), newImage);
  assert.equal(headingStyle(view).position, "absolute");
});
