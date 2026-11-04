import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement as h } from "react";
import { MemoryRouter } from "react-router-dom";
import { HoomaFrontendProvider } from "../packages/frontend/dist/context.js";
import { AthletesPage } from "../packages/frontend/dist/athletes/AthletesPages.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
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
const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

const json = (body) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });

function mount(bannerResponse, onCreate = () => {}) {
  let legacyRequests = 0;
  globalThis.fetch = async (input) => {
    const pathname = new URL(input).pathname;
    if (pathname.includes("/api/public/v1/banners/")) return bannerResponse();
    if (pathname.endsWith("/hero/delivery")) {
      legacyRequests++;
      throw new Error("retired hero endpoint must not be requested");
    }
    return json({ items: [], nextCursor: null });
  };
  const view = render(
    h(
      MemoryRouter,
      null,
      h(
        HoomaFrontendProvider,
        { transport: { baseUrl: "https://api.example.test" } },
        h(AthletesPage, { onCreateCommunity: onCreate }),
      ),
    ),
  );
  return { view, legacyRequests: () => legacyRequests };
}

test("Athletes hub renders Create community and tabs with no PageBanner when empty", async () => {
  let created = 0;
  const { view, legacyRequests } = mount(
    async () => json({ placementId: "ATHLETES_TOP", enabled: true, slides: [] }),
    () => created++,
  );
  await waitFor(() => assert.ok(view.getByRole("button", { name: /Create community/ })));
  assert.equal(view.container.querySelector("[data-page-banner]"), null);
  fireEvent.click(view.getByRole("button", { name: /Create community/ }));
  assert.equal(created, 1);
  fireEvent.click(view.getByRole("link", { name: "Requests" }));
  assert.equal(view.getByRole("link", { name: "Requests" }).getAttribute("aria-current"), "page");
  assert.equal(legacyRequests(), 0);
});

test("API failure leaves no native hero, no banner error box, and retains actions", async () => {
  const { view, legacyRequests } = mount(async () => {
    throw new Error("banner unavailable");
  });
  await waitFor(() => assert.ok(view.getByRole("button", { name: /Create community/ })));
  assert.equal(view.container.querySelector("[data-page-banner]"), null);
  assert.equal(view.queryByText("Banner unavailable."), null);
  assert.equal(view.queryByText("Move together. Train together."), null);
  assert.equal(legacyRequests(), 0);
});

test("pending banner API never displays an old hero or prevents community discovery", async () => {
  const { view, legacyRequests } = mount(() => new Promise(() => {}));
  assert.equal(view.container.querySelector("[data-page-banner]"), null);
  assert.ok(view.getByRole("button", { name: /Create community/ }));
  assert.ok(view.getByRole("link", { name: "Communities" }));
  assert.equal(legacyRequests(), 0);
});

test("disabled placement produces no empty hero footprint", async () => {
  const { view, legacyRequests } = mount(async () =>
    json({ placementId: "ATHLETES_TOP", enabled: false, slides: [] }),
  );
  await waitFor(() => assert.ok(view.getByRole("link", { name: "Communities" })));
  assert.equal(view.container.querySelector(".page-banner--athletes-hub"), null);
  assert.equal(legacyRequests(), 0);
});
