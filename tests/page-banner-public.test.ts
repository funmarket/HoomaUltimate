import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { afterEach } from "node:test";
import { JSDOM } from "jsdom";

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) {
      return { format: "module", source: "export default {};", shortCircuit: true };
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

Object.defineProperty(dom.window.HTMLImageElement.prototype, "decode", {
  configurable: true,
  value() {
    return Promise.resolve();
  },
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
});

function signedVariant(url: string, variant = "master", widthPx = 720) {
  return {
    variant,
    contentUrl: url,
    expiresAt: "2099-11-02T12:00:00.000Z",
    contentType: "image/webp",
    widthPx,
    heightPx: (widthPx * 13) / 18,
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

function response(slides: ReturnType<typeof slide>[] = [], enabled = true) {
  return { placementId: "ATHLETES_TOP", enabled, slides };
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

function mount(body: unknown) {
  globalThis.fetch = async () => json(body);
  return mountWithFetch();
}

function mountWithFetch() {
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

function findImage(view: ReturnType<typeof render>, fragment: string) {
  const image = [...view.container.querySelectorAll("img")].find((node) =>
    node.src.includes(fragment),
  );
  assert.ok(image, `managed image ${fragment} should be mounted`);
  return image;
}

async function loadImage(image: HTMLImageElement) {
  await act(async () => {
    fireEvent.load(image);
    await Promise.resolve();
  });
}

test("only a decoded mounted image becomes visible and preserves semantics", async () => {
  const view = mount(
    response([slide("slide-1", "Athletes training", { kind: "INTERNAL", url: "/athletes" })]),
  );
  await flushReact();
  const actual = findImage(view, "slide-1");
  assert.ok(view.container.querySelector(".hooma-lane--media")?.hasAttribute("hidden"));
  await loadImage(actual);
  await waitFor(() => assert.equal(view.getByRole("img", { name: "Athletes training" }), actual));
  assert.ok(!view.container.querySelector(".hooma-lane--media")?.hasAttribute("hidden"));
  assert.equal(
    view.getByRole("link", { name: "Athletes training" }).getAttribute("href"),
    "/athletes",
  );
  assert.equal(actual.getAttribute("width"), "720");
});

test("empty, disabled and API failures leave no optional media-lane footprint", async () => {
  for (const body of [response([], false), response()]) {
    const view = mount(body);
    await flushReact();
    assert.equal(view.container.querySelector(".hooma-lane--media"), null);
    cleanup();
  }
  globalThis.fetch = async () => {
    throw new Error("network unavailable");
  };
  const view = mountWithFetch();
  await flushReact();
  assert.equal(view.container.querySelector(".hooma-lane--media"), null);
});

test("image errors and decoding errors do not leave permanent blank media lanes", async () => {
  const view = mount(response([slide("slide-1")]));
  await flushReact();
  fireEvent.error(findImage(view, "slide-1"));
  await flushReact();
  assert.equal(view.container.querySelector(".hooma-lane--media"), null);
  cleanup();

  const second = mount(response([slide("slide-2")]));
  await flushReact();
  const badImage = findImage(second, "slide-2");
  Object.defineProperty(badImage, "decode", { value: () => Promise.reject(new Error("decode")) });
  await loadImage(badImage);
  await flushReact();
  assert.equal(second.container.querySelector(".hooma-lane--media"), null);
});

test("manual navigation retains old image until the new mounted image decodes", async () => {
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
  await loadImage(findImage(view, "slide-1"));
  const old = findImage(view, "slide-1");
  fireEvent.click(view.getByRole("button", { name: "Next banner" }));
  await flushReact();
  assert.equal(findImage(view, "slide-1"), old);
  assert.ok(view.getByRole("button", { name: "Next banner" }));
  const actualNext = findImage(view, "slide-2");
  assert.equal(actualNext.getAttribute("aria-hidden"), "true");
  await loadImage(actualNext);
  await waitFor(() =>
    assert.equal(view.getByRole("img", { name: "Community artwork" }), actualNext),
  );
  assert.equal(
    view.getByRole("link", { name: "Community artwork" }).getAttribute("rel"),
    "noreferrer noopener",
  );
  assert.equal(view.getByText("2 of 2").textContent, "2 of 2");
});

test("failed slides skip to healthy artwork without hiding the old image", async () => {
  const view = mount(response([slide("slide-1"), slide("slide-2"), slide("slide-3")]));
  await flushReact();
  await loadImage(findImage(view, "slide-1"));
  const previous = findImage(view, "slide-1");
  fireEvent.click(view.getByRole("button", { name: "Next banner" }));
  await flushReact();
  fireEvent.error(findImage(view, "slide-2"));
  await flushReact();
  assert.equal(findImage(view, "slide-1"), previous);
  await loadImage(findImage(view, "slide-3"));
  await waitFor(() =>
    assert.equal(findImage(view, "slide-3").getAttribute("aria-hidden"), "false"),
  );
});

test("expired URLs refresh without losing visible artwork", async () => {
  let reads = 0;
  const slides = [slide("slide-1"), slide("slide-2")];
  globalThis.fetch = async () => {
    reads++;
    return json(
      response(
        reads === 1
          ? slides
          : slides.map((item) => ({
              ...item,
              variants: [signedVariant(`https://media.example.test/fresh-${item.id}.webp`)],
            })),
      ),
    );
  };
  const view = mountWithFetch();
  await flushReact();
  await loadImage(findImage(view, "slide-1"));
  const visible = findImage(view, "slide-1");
  const originalNow = Date.now;
  Date.now = () => new Date("2099-11-02T11:59:45.000Z").getTime();
  try {
    fireEvent.click(view.getByRole("button", { name: "Next banner" }));
    await waitFor(() => assert.equal(reads, 2));
    assert.equal(findImage(view, "slide-1"), visible);
    await waitFor(() => assert.ok(findImage(view, "fresh-slide-2")));
    await loadImage(findImage(view, "fresh-slide-2"));
    await waitFor(() =>
      assert.equal(findImage(view, "fresh-slide-2").getAttribute("aria-hidden"), "false"),
    );
  } finally {
    Date.now = originalNow;
  }
});

test("mobile DPR selects the smallest adequate processed variant", async () => {
  const priorWidth = window.innerWidth;
  const priorDpr = window.devicePixelRatio;
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
  try {
    const variants = [
      signedVariant("https://media.example.test/master.webp", "master", 2160),
      signedVariant("https://media.example.test/display.webp", "display", 1440),
      signedVariant("https://media.example.test/mobile.webp", "mobile", 720),
    ];
    const view = mount(response([{ ...slide("slide-1"), variants }]));
    await flushReact();
    const image = findImage(view, "mobile.webp");
    await loadImage(image);
    assert.equal(image.getAttribute("aria-hidden"), "false");
  } finally {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: priorWidth });
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: priorDpr });
  }
});

test("expired mobile URL refreshes after viewport switch before downloading", async () => {
  const originalWidth = window.innerWidth;
  const originalDpr = window.devicePixelRatio;
  const originalNow = Date.now;
  let reads = 0;
  const variantSet = (prefix: string) => [
    signedVariant(`https://media.example.test/${prefix}-mobile.webp`, "mobile", 720),
    signedVariant(`https://media.example.test/${prefix}-display.webp`, "display", 1440),
  ];
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1000 });
  Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 1 });
  globalThis.fetch = async () => {
    reads++;
    return json(response([{ ...slide("slide-1"), variants: variantSet(reads === 1 ? "old" : "fresh") }]));
  };
  try {
    const view = mountWithFetch();
    await flushReact();
    await loadImage(findImage(view, "old-display.webp"));
    const visible = findImage(view, "old-display.webp");
    Date.now = () => new Date("2099-11-02T12:01:00.000Z").getTime();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    await act(async () => {
      fireEvent(window, new window.Event("resize"));
      await Promise.resolve();
    });
    await waitFor(() => assert.equal(reads, 2));
    assert.equal(findImage(view, "old-display.webp"), visible);
    assert.equal(view.container.querySelector('img[src*="old-mobile.webp"]'), null);
    await waitFor(() => assert.ok(findImage(view, "fresh-mobile.webp")));
    await loadImage(findImage(view, "fresh-mobile.webp"));
    await waitFor(() =>
      assert.equal(findImage(view, "fresh-mobile.webp").getAttribute("aria-hidden"), "false"),
    );
    assert.equal(reads, 2, "one variant switch must not poll for signed URLs");
  } finally {
    Date.now = originalNow;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: originalWidth });
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: originalDpr });
  }
});

test("decorative linked banner has an accessible name without changing its empty image alt", async () => {
  const view = mount(
    response([slide("slide-1", null, { kind: "INTERNAL", url: "/athletes" })]),
  );
  await flushReact();
  await loadImage(findImage(view, "slide-1"));
  const link = view.getByRole("link", { name: "Athletes banner" });
  assert.equal(link.getAttribute("href"), "/athletes");
  assert.equal(findImage(view, "slide-1").getAttribute("alt"), "");
});

test("late public reads after unmount never revive retired banner content", async () => {
  let resolveFetch: ((value: Response) => void) | undefined;
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
  const view = mountWithFetch();
  view.unmount();
  await act(async () => {
    resolveFetch?.(json(response([slide("slide-1")])));
    await Promise.resolve();
  });
  assert.equal(view.container.querySelector("[data-page-banner]"), null);
});
