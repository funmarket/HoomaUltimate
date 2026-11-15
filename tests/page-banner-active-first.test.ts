import assert from "node:assert/strict";
import test from "node:test";
import { createPageBannerApi } from "../packages/frontend/src/page-banner/api.ts";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
function fixture() {
  const original = globalThis.fetch;
  const calls: string[] = [];
  const images: {
    src: string;
    onload: null | (() => void);
    onerror: null | (() => void);
    decode: () => Promise<void>;
    removeAttribute: () => void;
  }[] = [];
  globalThis.fetch = async (url) => {
    const id = new URL(String(url), "http://api.test").pathname.split("/").at(-1)!;
    calls.push(id);
    return Response.json({
      placementId: id,
      enabled: true,
      slides: [
        {
          id,
          artworkVersion: id,
          sortOrder: 0,
          isDecorative: true,
          altText: null,
          destination: null,
          variants: [
            {
              variant: "mobile",
              delivery: "IMMUTABLE",
              expiresAt: null,
              contentUrl: `/artwork/${id}`,
              contentType: "image/webp",
              widthPx: 720,
              heightPx: 300,
            },
          ],
        },
      ],
    });
  };
  const api = createPageBannerApi(
    { baseUrl: "http://api.test" },
    {
      createImage: () => {
        const image = {
          src: "",
          onload: null,
          onerror: null,
          complete: false,
          naturalWidth: 0,
          decode: () => Promise.resolve(),
          removeAttribute: () => {},
        };
        images.push(image);
        return image as unknown as HTMLImageElement;
      },
    },
  );
  return {
    api,
    calls,
    images,
    close: () => {
      api.beginActive("HOME_TOP");
      for (const image of images) image.onerror?.();
      globalThis.fetch = original;
    },
  };
}

test("startup makes no background metadata request before the mounted active banner settles", async () => {
  const f = fixture();
  assert.equal(typeof f.api.beginActive, "function", "Active lifecycle gate is missing");
  try {
    const session = f.api.prepareSession();
    await tick();
    assert.deepEqual(f.calls, []);
    const active = f.api.beginActive("HOME_TOP");
    await f.api.prefetch("HOME_TOP");
    await tick();
    assert.deepEqual(f.calls, ["HOME_TOP"]);
    // Even detached preparation completing must not impersonate mounted visibility.
    f.images[0]!.onload?.();
    await tick();
    assert.deepEqual(f.calls, ["HOME_TOP"]);
    active.settle();
    await session;
    assert.equal(f.calls.length, 11);
    active.release();
  } finally {
    f.close();
  }
});

test("navigation pauses queued background images and stale owners cannot release the new route", async () => {
  const f = fixture();
  assert.equal(typeof f.api.beginActive, "function", "Active lifecycle gate is missing");
  try {
    const home = f.api.beginActive("HOME_TOP");
    await f.api.publicRead("HOME_TOP");
    const session = f.api.prepareSession();
    home.settle();
    await session;
    await tick();
    assert.equal(f.images.filter((image) => image.src).length, 1);
    const watch = f.api.beginActive("WATCH_TOP");
    home.settle();
    home.release();
    f.images.find((image) => image.src)!.onload?.();
    await tick();
    assert.equal(
      f.images.filter((image) => image.src).length,
      1,
      "No new queued image may start while Watch is pending",
    );
    await f.api.prefetch("WATCH_TOP");
    await tick();
    assert.equal(
      f.images.filter((image) => image.src).length,
      2,
      "Active Watch must bypass the paused queue",
    );
    watch.settle();
    await tick();
    assert.equal(f.images.filter((image) => image.src).length, 3);
    watch.release();
  } finally {
    f.close();
  }
});

test("StrictMode stale cleanup cannot unpause a replacement owner of the same placement", async () => {
  const f = fixture();
  assert.equal(typeof f.api.beginActive, "function", "Active lifecycle gate is missing");
  try {
    f.api.prepareSession();
    const first = f.api.beginActive("HOME_TOP");
    first.release();
    const current = f.api.beginActive("HOME_TOP");
    first.settle();
    await tick();
    assert.deepEqual(f.calls, []);
    current.settle();
    await tick();
    assert(f.calls.length > 0);
    current.release();
  } finally {
    f.close();
  }
});

test("a route change in the wake-up microtask cannot start background metadata", async () => {
  const f = fixture();
  try {
    const home = f.api.beginActive("HOME_TOP");
    f.api.prepareSession();
    home.settle();
    queueMicrotask(() => f.api.beginActive("WATCH_TOP"));
    await tick();
    assert.deepEqual(f.calls, []);
  } finally {
    f.close();
  }
});
