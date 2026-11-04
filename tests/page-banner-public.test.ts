import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { afterEach } from "node:test";
import { JSDOM } from "jsdom";

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

class PendingImage {
  static instances: PendingImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 720;
  naturalHeight = 520;
  complete = false;
  src = "";
  decode = async () => {};

  constructor() {
    PendingImage.instances.push(this);
  }

  load() {
    this.complete = true;
    this.onload?.();
  }

  fail() {
    this.onerror?.();
  }
}

Object.defineProperty(globalThis, "Image", {
  value: PendingImage,
  configurable: true,
  writable: true,
});

const React = await import("react");
Object.defineProperty(globalThis, "React", {
  value: React,
  configurable: true,
});
const { act, cleanup, fireEvent, render, waitFor } = await import("@testing-library/react");
const { HoomaFrontendProvider } = await import("../packages/frontend/src/context");
const { PageBanner } = await import("../packages/frontend/src/page-banner/PageBanner");

const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  PendingImage.instances.length = 0;
});

function signedVariant(url: string) {
  return {
    variant: "master",
    contentUrl: url,
    expiresAt: "2026-11-02T12:00:00.000Z",
    contentType: "image/webp",
    widthPx: 720,
    heightPx: 520,
  };
}

function slide(
  id: string,
  altText: string | null = null,
  destination: { kind: "INTERNAL" | "EXTERNAL"; url: string } | null = null,
) {
  return {
    id,
    sortOrder: Number(id.replace("slide-", "")) - 1,
    isDecorative: altText === null,
    altText,
    destination,
    variants: [signedVariant(`https://media.example.test/${id}.webp`)],
  };
}

function response(
  slides: ReturnType<typeof slide>[] = [],
  enabled = true,
) {
  return { placementId: "ATHLETES_TOP", enabled, slides };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function mount(body: unknown) {
  globalThis.fetch = async () => json(body);
  return render(
    React.createElement(
      HoomaFrontendProvider,
      { transport: { baseUrl: "https://api.example.test" } },
      React.createElement(PageBanner, { placementId: "ATHLETES_TOP" }),
    ),
  );
}

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function loadNext() {
  const next = PendingImage.instances.at(-1);
  assert.ok(next, "a managed image must be requested");
  await act(async () => {
    next.load();
    await Promise.resolve();
  });
}

test("decoded managed slide is the only displayed PageBanner artwork", async () => {
  const view = mount(response([slide("slide-1", "Athletes training", { kind: "INTERNAL", url: "/athletes" })]));
  assert.equal(view.container.querySelector("[data-page-banner]"), null);
  await flushReact();
  assert.equal(view.container.querySelector("[data-page-banner]"), null);
  await loadNext();
  const image = view.getByRole("img", { name: "Athletes training" });
  assert.equal(image.getAttribute("src"), "https://media.example.test/slide-1.webp");
  assert.equal(image.getAttribute("width"), "720");
  assert.equal(image.getAttribute("height"), "520");
  assert.equal(view.getByRole("link", { name: "Athletes training" }).getAttribute("href"), "/athletes");
  assert.equal(view.getByRole("region", { name: "Athletes banner" }).getAttribute("aria-live"), null);
});

test("disabled or empty placements never render a fallback, loading, or error hero", async () => {
  for (const body of [response([], false), response()]) {
    const view = mount(body);
    assert.equal(view.container.querySelector("[data-page-banner]"), null);
    await flushReact();
    assert.equal(view.container.querySelector("[data-page-banner]"), null);
    assert.equal(view.container.querySelector("img"), null);
    cleanup();
  }
});

test("public API errors display no PageBanner or native substitute", async () => {
  globalThis.fetch = async () => {
    throw new Error("network unavailable");
  };
  const view = render(
    React.createElement(
      HoomaFrontendProvider,
      { transport: { baseUrl: "https://api.example.test" } },
      React.createElement(PageBanner, { placementId: "ATHLETES_TOP" }),
    ),
  );
  await flushReact();
  assert.equal(view.container.querySelector("[data-page-banner]"), null);
  assert.equal(view.queryByText("Banner unavailable."), null);
});

test("media load and decode failures never expose a broken image surface", async () => {
  const view = mount(response([slide("slide-1")]));
  await flushReact();
  assert.equal(PendingImage.instances.length, 1);
  await act(async () => {
    PendingImage.instances[0]!.fail();
  });
  assert.equal(view.container.querySelector("[data-page-banner]"), null);
  cleanup();

  const secondView = mount(response([slide("slide-2")]));
  await flushReact();
  const second = PendingImage.instances.at(-1)!;
  second.decode = async () => {
    throw new Error("decode failed");
  };
  await loadNext();
  assert.equal(secondView.container.querySelector("[data-page-banner]"), null);
});

test("manual navigation reveals only a decoded new slide and retains secure destinations", async () => {
  const view = mount(
    response([
      slide("slide-1"),
      slide("slide-2", "Community artwork", {
        kind: "EXTERNAL",
        url: "https://example.test/community",
      }),
    ]),
  );
  await flushReact();
  await loadNext();
  assert.equal(view.container.querySelector("img")?.getAttribute("alt"), "");

  fireEvent.click(view.getByRole("button", { name: "Next banner" }));
  assert.equal(view.container.querySelector("[data-page-banner]"), null);
  await flushReact();
  await loadNext();
  await waitFor(() => assert.ok(view.getByRole("img", { name: "Community artwork" })));
  assert.equal(
    view.getByRole("link", { name: "Community artwork" }).getAttribute("href"),
    "https://example.test/community",
  );
  assert.equal(
    view.getByRole("link", { name: "Community artwork" }).getAttribute("rel"),
    "noreferrer noopener",
  );
  assert.equal(view.getByText("2 of 2").textContent, "2 of 2");
});

test("unmounting during a pending request cannot resurrect a stale banner", async () => {
  let resolveFetch: ((value: Response) => void) | undefined;
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
  const view = render(
    React.createElement(
      HoomaFrontendProvider,
      { transport: { baseUrl: "https://api.example.test" } },
      React.createElement(PageBanner, { placementId: "ATHLETES_TOP" }),
    ),
  );
  view.unmount();
  await act(async () => {
    resolveFetch?.(json(response([slide("slide-1")])));
    await Promise.resolve();
  });
  assert.equal(view.container.querySelector("[data-page-banner]"), null);
  assert.equal(PendingImage.instances.length, 0);
});
