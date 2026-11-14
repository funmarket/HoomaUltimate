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

test("concurrent public reads for a placement share one request", async () => {
  let calls = 0;
  let resolveFetch!: (value: Response) => void;
  globalThis.fetch = () => {
    calls += 1;
    return new Promise((resolve) => (resolveFetch = resolve));
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    const first = api.publicRead("PLAY_TOP");
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
    await old;
    assert.equal(await api.publicRead("HOOMA_TOP"), fresh);
    assert.equal(calls, 2);
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
