import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement as h } from "react";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return {
        format: "module",
        source: "export default {};",
        shortCircuit: true,
      };
    }
    return nextLoad(url, context);
  },
});

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/",
});
for (const key of ["window", "document", "HTMLElement", "Element", "Node", "navigator"]) {
  Object.defineProperty(globalThis, key, {
    value: dom.window[key],
    configurable: true,
    writable: true,
  });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
const { HoomaFrontendProvider } = await import("../packages/frontend/src/context");
const { PageBanner } = await import("../packages/frontend/src/page-banner/PageBanner");

const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

const signedVariant = (url: string) => ({
  variant: "master",
  contentUrl: url,
  expiresAt: "2026-11-02T12:00:00.000Z",
  contentType: "image/webp",
  widthPx: 1200,
  heightPx: 400,
});

function mount(body: unknown) {
  globalThis.fetch = async () =>
    new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  return render(
    h(
      HoomaFrontendProvider,
      { transport: { baseUrl: "https://api.example.test" } },
      h(PageBanner, { placementId: "ATHLETES_TOP" }),
    ),
  );
}

test("public PageBanner renders a signed Athletes slide with accessible metadata", async () => {
  const view = mount({
    placementId: "ATHLETES_TOP",
    enabled: true,
    slides: [
      {
        id: "slide-1",
        sortOrder: 0,
        isDecorative: false,
        altText: "Athletes training together",
        destination: { kind: "INTERNAL", url: "/athletes" },
        variants: [signedVariant("https://media.example.test/slide-1.webp")],
      },
    ],
  });

  await waitFor(() => assert.ok(view.getByRole("img", { name: "Athletes training together" })));
  const image = view.getByRole("img", { name: "Athletes training together" });
  assert.equal(image.getAttribute("src"), "https://media.example.test/slide-1.webp");
  assert.equal(
    view.getByRole("link", { name: "Athletes training together" }).getAttribute("href"),
    "/athletes",
  );
  assert.equal(
    view.getByRole("region", { name: "Athletes banner" }).getAttribute("aria-live"),
    null,
  );
});

test("public PageBanner manually navigates ordered slides without auto-rotation", async () => {
  const view = mount({
    placementId: "ATHLETES_TOP",
    enabled: true,
    slides: [
      {
        id: "slide-1",
        sortOrder: 0,
        isDecorative: true,
        altText: null,
        destination: null,
        variants: [signedVariant("https://media.example.test/slide-1.webp")],
      },
      {
        id: "slide-2",
        sortOrder: 1,
        isDecorative: false,
        altText: "Athletes community",
        destination: {
          kind: "EXTERNAL",
          url: "https://example.test/community",
        },
        variants: [signedVariant("https://media.example.test/slide-2.webp")],
      },
    ],
  });

  await waitFor(() => assert.ok(view.getByRole("button", { name: "Next banner" })));
  assert.equal(view.getByRole("img").getAttribute("alt"), "");
  fireEvent.click(view.getByRole("button", { name: "Next banner" }));
  await waitFor(() => assert.ok(view.getByRole("img", { name: "Athletes community" })));
  assert.equal(
    view.getByRole("link", { name: "Athletes community" }).getAttribute("href"),
    "https://example.test/community",
  );
  assert.equal(view.getByText("2 of 2").textContent, "2 of 2");
});

test("public PageBanner renders no public surface for disabled or empty placements", async () => {
  for (const body of [
    { placementId: "ATHLETES_TOP", enabled: false, slides: [] },
    { placementId: "ATHLETES_TOP", enabled: true, slides: [] },
  ]) {
    const view = mount(body);
    await waitFor(() => assert.equal(view.container.querySelector("[data-page-banner]"), null));
    cleanup();
  }
});
