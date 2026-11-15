import assert from "node:assert/strict";
import test from "node:test";
import type { PageBannerPlacementId } from "@hooma/contracts/page-banner";
import { createPageBannerApi } from "../packages/frontend/src/page-banner/api.ts";
import { createPlatformAdminApi } from "../packages/frontend/src/platform-admin/api.ts";

const originalFetch = globalThis.fetch;
const originalNow = Date.now;

function response(
  placementId = "HOME_TOP",
  expiresAt = new Date(Date.now() + 300_000).toISOString(),
) {
  return new Response(
    JSON.stringify({
      placementId,
      enabled: true,
      slides: [
        {
          id: "slide-1",
          sortOrder: 0,
          isDecorative: true,
          altText: null,
          destination: null,
          variants: [
            {
              variant: "display",
              contentUrl: `https://media.test/${placementId}.webp?sig=${expiresAt}`,
              expiresAt,
              contentType: "image/webp",
              widthPx: 1440,
              heightPx: 600,
            },
          ],
        },
      ],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

test("public PageBanner reads cache valid response briefly and revisit reuses it", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response();
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    const first = await api.publicRead("HOME_TOP");
    const second = await api.publicRead("HOME_TOP");
    assert.equal(calls, 1);
    assert.equal(second, first);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("public PageBanner freshness expires after its short window", async () => {
  const now = Date.now();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response("PLAY_TOP");
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    Date.now = () => now;
    await api.publicRead("PLAY_TOP");
    await api.publicRead("PLAY_TOP");
    Date.now = () => now + 15_001;
    await api.publicRead("PLAY_TOP");
    assert.equal(calls, 2);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("public PageBanner cache evicts the least recently used placement at its bound", async () => {
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls += 1;
    const placementId = new URL(String(input)).pathname.split("/").at(-1) ?? "HOME_TOP";
    return response(placementId);
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    const placements = Array.from({ length: 12 }, (_, index) => `PLACEMENT_${index}`);
    for (const placementId of placements) {
      await api.publicRead(placementId as PageBannerPlacementId);
    }
    await api.publicRead(placements[0] as PageBannerPlacementId);
    assert.equal(calls, 13);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("prefetch and the mounting PageBanner public read share one request", async () => {
  let calls = 0;
  let resolveFetch!: (value: Response) => void;
  globalThis.fetch = () => {
    calls += 1;
    return new Promise((resolve) => (resolveFetch = resolve));
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    const first = api.prefetch("PLAY_TOP");
    const second = api.publicRead("PLAY_TOP");
    assert.equal(calls, 1);
    resolveFetch(response("PLAY_TOP"));
    assert.equal(await first, await second);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failed public reads are retried instead of being cached", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return calls === 1
      ? new Response("{}", { status: 503, headers: { "content-type": "application/json" } })
      : response("WATCH_TOP");
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    await assert.rejects(api.publicRead("WATCH_TOP"));
    await api.publicRead("WATCH_TOP");
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("near-expiry signed URLs are not reused and forced reads bypass the cache", async () => {
  const now = Date.now();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response("HOME_TOP", new Date(now + (calls === 1 ? 50_000 : 300_000)).toISOString());
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    await api.publicRead("HOME_TOP");
    const fresh = await api.publicRead("HOME_TOP");
    assert.equal(calls, 2);
    assert.ok(Date.parse(fresh.slides[0]!.variants[0]!.expiresAt) > now + 60_000);
    await api.publicRead("HOME_TOP", { forceFresh: true });
    assert.equal(calls, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("forced-fresh reads reject responses whose signed URLs are expired or near expiry", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response("HOME_TOP", new Date(Date.now() + 30_000).toISOString());
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    await assert.rejects(api.publicRead("HOME_TOP", { forceFresh: true }), /fresh signed URL/i);
    await api.publicRead("HOME_TOP");
    assert.equal(calls, 2, "rejected fresh data must not be cached or reused");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an older request cannot replace the response from a forced-fresh read", async () => {
  let resolveOld!: (value: Response) => void;
  let calls = 0;
  globalThis.fetch = () => {
    calls += 1;
    if (calls === 1) return new Promise((resolve) => (resolveOld = resolve));
    return Promise.resolve(response("HOOMA_TOP"));
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    const old = api.publicRead("HOOMA_TOP");
    const fresh = await api.publicRead("HOOMA_TOP", { forceFresh: true });
    resolveOld(response("HOOMA_TOP", new Date(Date.now() + 240_000).toISOString()));
    assert.equal(await old, fresh, "older callers follow the newer response");
    assert.equal(await api.publicRead("HOOMA_TOP"), fresh);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a response invalidated before completion is not returned as current data", async () => {
  let resolveFetch!: (value: Response) => void;
  globalThis.fetch = () => new Promise((resolve) => (resolveFetch = resolve));
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    const pending = api.publicRead("HOOMA_TOP");
    api.invalidate("HOOMA_TOP");
    resolveFetch(response("HOOMA_TOP"));
    await assert.rejects(pending, /superseded/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("expired-URL checks use the current clock", async () => {
  const now = Date.now();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response("ATHLETES_TOP", new Date(now + (calls === 1 ? 90_000 : 300_000)).toISOString());
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    await api.publicRead("ATHLETES_TOP");
    Date.now = () => now + 40_000;
    await api.publicRead("ATHLETES_TOP");
    assert.equal(calls, 2);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("successful Admin changes invalidate enabled and deleted-slide public state", async () => {
  let enabled = true;
  let hasSlide = true;
  let reads = 0;
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/public/v1/banners/HOME_TOP") {
      reads += 1;
      return responseWithState(enabled, hasSlide);
    }
    if (init?.method === "PATCH" && path === "/api/v1/admin/banners/HOME_TOP") enabled = false;
    if (init?.method === "DELETE" && path.endsWith("/slides/slide-1")) hasSlide = false;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  };
  function responseWithState(isEnabled: boolean, includeSlide: boolean) {
    return new Response(
      JSON.stringify({
        placementId: "HOME_TOP",
        enabled: isEnabled,
        slides: includeSlide
          ? [
              {
                id: "slide-1",
                sortOrder: 0,
                isDecorative: true,
                altText: null,
                destination: null,
                variants: [
                  {
                    variant: "display",
                    contentUrl: "https://media.test/HOME_TOP.webp?admin-state",
                    expiresAt: new Date(Date.now() + 300_000).toISOString(),
                    contentType: "image/webp",
                    widthPx: 1440,
                    heightPx: 600,
                  },
                ],
              },
            ]
          : [],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }
  try {
    const transport = { baseUrl: "http://api.test" };
    const publicApi = createPageBannerApi(transport);
    const adminApi = createPlatformAdminApi(transport, {
      onPageBannerMutation: publicApi.invalidate,
    });
    const initiallyEnabled = await publicApi.publicRead("HOME_TOP");
    assert.equal(initiallyEnabled.enabled, true);
    await adminApi.pageBanners.setEnabled("HOME_TOP", false);
    const disabled = await publicApi.publicRead("HOME_TOP");
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.slides.length, 1);
    await adminApi.pageBanners.deleteSlide("HOME_TOP", "slide-1");
    const deleted = await publicApi.publicRead("HOME_TOP");
    assert.equal(deleted.slides.length, 0);
    assert.equal(reads, 3);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("metadata revalidates after 15 seconds while unchanged artwork retains its original valid URL and expiry", async () => {
  const now = Date.now();
  let clock = now;
  let calls = 0;
  let version = "media-one";
  let enabled = true;
  globalThis.fetch = async () => {
    calls++;
    const data = await response("HOME_TOP", new Date(clock + 300_000).toISOString()).json();
    data.enabled = enabled;
    data.slides[0].artworkVersion = version;
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  };
  Date.now = () => clock;
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    const initial = await api.publicRead("HOME_TOP");
    clock += 15_001;
    const renewed = await api.publicRead("HOME_TOP");
    assert.equal(calls, 2);
    assert.equal(
      renewed.slides[0]?.variants[0]?.contentUrl,
      initial.slides[0]?.variants[0]?.contentUrl,
    );
    assert.equal(
      renewed.slides[0]?.variants[0]?.expiresAt,
      initial.slides[0]?.variants[0]?.expiresAt,
    );
    version = "media-two";
    clock += 15_001;
    const replaced = await api.publicRead("HOME_TOP");
    assert.notEqual(
      replaced.slides[0]?.variants[0]?.contentUrl,
      initial.slides[0]?.variants[0]?.contentUrl,
    );
    enabled = false;
    clock += 15_001;
    assert.equal((await api.publicRead("HOME_TOP")).enabled, false);
    enabled = true;
    clock += 15_001;
    const reenabled = await api.publicRead("HOME_TOP");
    assert.notEqual(
      reenabled.slides[0]?.variants[0]?.contentUrl,
      replaced.slides[0]?.variants[0]?.contentUrl,
    );
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});

test("session preparation is one serial pass and never retries the already requested active placement", async () => {
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    const id = new URL(String(input)).pathname.split("/").at(-1)!;
    requests.push(id);
    if (id === "ATHLETES_TOP") throw new Error("active offline");
    return response(id);
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    await assert.rejects(api.publicRead("ATHLETES_TOP"));
    api.beginActive("ATHLETES_TOP").settle();
    const first = api.prepareSession();
    assert.equal(first, api.prepareSession());
    await first;
    assert.equal(requests.length, 11);
    assert.equal(new Set(requests).size, 11);
    await api.prepareSession();
    assert.equal(requests.length, 11);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("navigation prefetch starts the selected artwork before a component mounts", async () => {
  const requests: string[] = [];
  const image = {
    complete: false,
    naturalWidth: 0,
    onload: null,
    onerror: null,
    decode: async () => {},
    removeAttribute() {},
    set src(url: string) {
      requests.push(url);
    },
  } as unknown as HTMLImageElement;
  globalThis.fetch = async () => response("PLAY_TOP");
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" }, { createImage: () => image });
    await api.prefetch("PLAY_TOP");
    await Promise.resolve();
    assert.equal(requests.length, 1);
    assert.match(requests[0]!, /PLAY_TOP/);
    image.onload?.(new Event("load"));
    await Promise.resolve();
    api.invalidate("PLAY_TOP");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a failed preloaded URL is not retained across a subsequent metadata read", async () => {
  const now = Date.now();
  let clock = now;
  const image = {
    complete: false,
    naturalWidth: 0,
    onload: null,
    onerror: null,
    removeAttribute() {},
    set src(_url: string) {},
  } as unknown as HTMLImageElement;
  globalThis.fetch = async () => {
    const data = await response("HOME_TOP", new Date(clock + 300_000).toISOString()).json();
    data.slides[0].artworkVersion = "same-artwork";
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  };
  Date.now = () => clock;
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" }, { createImage: () => image });
    const first = await api.prefetch("HOME_TOP");
    await Promise.resolve();
    image.onerror?.(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    clock += 15_001;
    const next = await api.publicRead("HOME_TOP");
    assert.notEqual(
      next.slides[0]?.variants[0]?.contentUrl,
      first.slides[0]?.variants[0]?.contentUrl,
    );
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("invalidation between cached prefetch and its continuation prevents stale image preparation", async () => {
  let created = 0;
  globalThis.fetch = async () => response();
  try {
    const api = createPageBannerApi(
      { baseUrl: "http://api.test" },
      {
        createImage: () => {
          created++;
          return null;
        },
      },
    );
    await api.publicRead("HOME_TOP");
    const pending = api.prefetch("HOME_TOP");
    api.invalidate("HOME_TOP");
    await pending;
    await Promise.resolve();
    assert.equal(created, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failure of a retained image invalidates refreshed metadata still referencing that URL", async () => {
  let clock = Date.now();
  let reads = 0;
  const image = {
    complete: false,
    naturalWidth: 0,
    onload: null,
    onerror: null,
    removeAttribute() {},
    set src(_url: string) {},
  } as unknown as HTMLImageElement;
  globalThis.fetch = async () => {
    reads++;
    const data = await response("HOME_TOP", new Date(clock + 300_000).toISOString()).json();
    data.slides[0].artworkVersion = "unchanged-artwork";
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  };
  Date.now = () => clock;
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" }, { createImage: () => image });
    const initial = await api.prefetch("HOME_TOP");
    await Promise.resolve();
    clock += 15_001;
    const renewed = await api.publicRead("HOME_TOP");
    assert.equal(
      renewed.slides[0]?.variants[0]?.contentUrl,
      initial.slides[0]?.variants[0]?.contentUrl,
    );
    image.onerror?.(new Event("error"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const retried = await api.publicRead("HOME_TOP");
    assert.equal(reads, 3);
    assert.notEqual(
      retried.slides[0]?.variants[0]?.contentUrl,
      initial.slides[0]?.variants[0]?.contentUrl,
    );
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("replacement metadata cancels queued artwork before its background slot opens", async () => {
  let clock = Date.now();
  let replaced = false;
  const images: HTMLImageElement[] = [];
  const started: string[] = [];
  globalThis.fetch = async (input) => {
    const id = new URL(String(input)).pathname.split("/").at(-1)!;
    const data = await response(id, new Date(clock + 300_000).toISOString()).json();
    data.enabled = id === "HOME_TOP" || id === "PLAY_TOP";
    data.slides[0].artworkVersion = replaced && id === "PLAY_TOP" ? "new-media" : "old-media";
    data.slides[0].variants[0].contentUrl = `https://media.test/${id}-${data.slides[0].artworkVersion}`;
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  };
  Date.now = () => clock;
  try {
    const api = createPageBannerApi(
      { baseUrl: "http://api.test" },
      {
        createImage: () => {
          const image = {
            complete: false,
            naturalWidth: 0,
            onload: null,
            onerror: null,
            removeAttribute() {},
            decode: async () => {},
            set src(url: string) {
              started.push(url);
            },
          } as unknown as HTMLImageElement;
          images.push(image);
          return image;
        },
      },
    );
    api.beginActive("WATCH_TOP").settle();
    await api.prepareSession();
    clock += 15_001;
    replaced = true;
    await api.publicRead("PLAY_TOP");
    images[0]!.onload?.(new Event("load"));
    await Promise.resolve();
    await Promise.resolve();
    api.invalidate("HOME_TOP");
    api.invalidate("PLAY_TOP");
    assert.deepEqual(started, ["https://media.test/HOME_TOP-old-media"]);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});
