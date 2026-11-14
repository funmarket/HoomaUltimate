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
  enabled = true,
) {
  return new Response(
    JSON.stringify({
      placementId,
      enabled,
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

test("public PageBanner metadata remains reusable beyond the old 15-second window", async () => {
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
    Date.now = () => now + 30_001;
    await api.publicRead("PLAY_TOP");
    assert.equal(calls, 1);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("enabled metadata freshness never outlives its bounded window or signed URL", async () => {
  const now = Date.now();
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response("PLAY_TOP", new Date(now + 300_000).toISOString());
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    Date.now = () => now;
    await api.publicRead("PLAY_TOP");
    Date.now = () => now + 239_999;
    await api.publicRead("PLAY_TOP");
    assert.equal(calls, 1);
    Date.now = () => now + 240_001;
    await api.publicRead("PLAY_TOP");
    assert.equal(calls, 2);
  } finally {
    Date.now = originalNow;
    globalThis.fetch = originalFetch;
  }
});

test("session preparation prioritizes the active placement and prepares all canonical placements once", async () => {
  const { PAGE_BANNER_PLACEMENT_IDS } = await import("@hooma/contracts/page-banner");
  const requests: string[] = [];
  let active = 0;
  let maximumActive = 0;
  globalThis.fetch = async (input) => {
    const placementId = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    requests.push(placementId);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    await Promise.resolve();
    active -= 1;
    return response(placementId, new Date(Date.now() + 300_000).toISOString(), false);
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    await api.prepareSession("PITCH_TOP", 720);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(requests[0], "PITCH_TOP", "the direct-entry placement starts first");
    assert.deepEqual(
      new Set(requests),
      new Set(PAGE_BANNER_PLACEMENT_IDS),
      "all canonical placements are prepared without consulting navigation destinations",
    );
    assert.equal(requests.length, PAGE_BANNER_PLACEMENT_IDS.length);
    assert.ok(maximumActive <= 3, `metadata concurrency was ${maximumActive}`);
    await api.prepareSession("PITCH_TOP", 720);
    assert.equal(requests.length, PAGE_BANNER_PLACEMENT_IDS.length, "session startup is once only");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a route visit promotes queued metadata work and shares its response", async () => {
  const requests: string[] = [];
  const held = new Map<string, (value: Response) => void>();
  globalThis.fetch = (input) => {
    const placementId = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    requests.push(placementId);
    return new Promise((resolve) => {
      held.set(placementId, resolve);
      setTimeout(() => resolve(response(placementId)), 15);
    });
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    const active = api.prepareSession("HOME_TOP", 720);
    assert.equal(requests[0], "HOME_TOP");
    await Promise.resolve();
    await Promise.resolve();
    const initialCount = requests.length;
    const directEntry = api.publicRead("ATHLETES_TOP");
    assert.equal(requests.length, initialCount);
    held.get("HOME_TOP")?.(response("HOME_TOP"));
    await active;
    await Promise.resolve();
    await Promise.resolve();
    assert.ok(requests.includes("ATHLETES_TOP"), "active route is promoted when a slot opens");
    const newest = held.get("ATHLETES_TOP");
    newest?.(response("ATHLETES_TOP"));
    await directEntry;
    await new Promise((resolve) => setTimeout(resolve, 100));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("startup prepares only the first selected image per enabled placement and reuses it", async () => {
  const loaded: string[] = [];
  let activeImages = 0;
  let maximumImages = 0;
  const createImage = () => {
    const image: {
      src: string;
      fetchPriority: string;
      onload: (() => void) | null;
      onerror: (() => void) | null;
      decode: () => Promise<void>;
    } = {
      src: "",
      fetchPriority: "auto",
      onload: null,
      onerror: null,
      decode: async () => undefined,
    };
    Object.defineProperty(image, "src", {
      get: () => (image as { _src?: string })._src ?? "",
      set: (value: string) => {
        (image as { _src?: string })._src = value;
        loaded.push(value);
        activeImages += 1;
        maximumImages = Math.max(maximumImages, activeImages);
        queueMicrotask(() => {
          activeImages -= 1;
          image.onload?.();
        });
      },
    });
    return image as unknown as HTMLImageElement;
  };
  let reads = 0;
  const requested: string[] = [];
  globalThis.fetch = async (input) => {
    reads += 1;
    const placementId = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    requested.push(placementId);
    const payload = JSON.parse(await response(placementId).text()) as {
      slides: Array<Record<string, unknown>>;
    };
    if (placementId === "HOME_TOP") {
      payload.slides.push(
        ...[2, 3].map((sortOrder) => ({
          ...payload.slides[0],
          id: `slide-${sortOrder}`,
          sortOrder,
          variants: [
            {
              ...(payload.slides[0]?.variants as Array<Record<string, unknown>>)[0],
              contentUrl: `https://media.test/HOME_TOP-${sortOrder}.webp`,
            },
          ],
        })),
      );
    }
    return new Response(JSON.stringify(payload), {
      headers: { "content-type": "application/json" },
    });
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" }, { createImage });
    await api.prepareSession("HOME_TOP", 720);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(loaded.length, 11, "only the first artwork from each enabled placement is loaded");
    assert.ok(maximumImages <= 2, `image concurrency was ${maximumImages}`);
    const beforeVisit = reads;
    assert.equal(await api.publicRead("PLAY_TOP"), await api.publicRead("PLAY_TOP"));
    assert.equal(reads, beforeVisit, `the warm visit unexpectedly fetched ${requested.join(",")}`);
    await api.prepareArtwork("PLAY_TOP", await api.publicRead("PLAY_TOP"), 720, "active");
    assert.equal(loaded.filter((url) => url.includes("PLAY_TOP")).length, 1);
    assert.equal(reads, 11, `unexpected metadata requests: ${requested.join(",")}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("startup uses the current viewport variant and gives only its active image high priority", async () => {
  const loaded: Array<{ url: string; priority: string }> = [];
  const createImage = () => {
    const image = {
      fetchPriority: "auto",
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      decode: async () => undefined,
      set src(url: string) {
        loaded.push({ url, priority: image.fetchPriority });
        queueMicrotask(() => image.onload?.());
      },
    };
    return image as unknown as HTMLImageElement;
  };
  globalThis.fetch = async (input) => {
    const placementId = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    const body = JSON.parse(await response(placementId).text()) as {
      slides: Array<{ variants: Array<Record<string, unknown>> }>;
    };
    body.slides[0]!.variants = [
      {
        ...body.slides[0]!.variants[0]!,
        variant: "mobile",
        widthPx: 720,
        contentUrl: `https://media.test/${placementId}-mobile.webp`,
      },
      {
        ...body.slides[0]!.variants[0]!,
        variant: "display",
        widthPx: 1440,
        contentUrl: `https://media.test/${placementId}-display.webp`,
      },
      {
        ...body.slides[0]!.variants[0]!,
        variant: "master",
        widthPx: 2160,
        contentUrl: `https://media.test/${placementId}-master.webp`,
      },
    ];
    return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" }, { createImage });
    await api.prepareSession("HOME_TOP", 900);
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.ok(
      loaded.some((item) => item.url.endsWith("HOME_TOP-display.webp") && item.priority === "high"),
    );
    assert.ok(
      loaded.some((item) => item.url.endsWith("PLAY_TOP-display.webp") && item.priority === "low"),
    );
    assert.ok(loaded.every((item) => item.url.includes("-display.webp")));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Admin invalidation discards prepared image resources and expired URLs are never prepared", async () => {
  const loaded: string[] = [];
  const createImage = () => {
    const image = {
      fetchPriority: "auto",
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      decode: async () => undefined,
      set src(value: string) {
        loaded.push(value);
        queueMicrotask(() => image.onload?.());
      },
    };
    return image as unknown as HTMLImageElement;
  };
  let version = 0;
  globalThis.fetch = async (input) => {
    const placementId = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    return response(
      placementId,
      new Date(Date.now() + (version === 0 ? 300_000 : 30_000)).toISOString(),
    );
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" }, { createImage });
    const first = await api.publicRead("HOME_TOP");
    await api.prepareArtwork("HOME_TOP", first, 720, "active");
    assert.equal(loaded.length, 1);
    api.invalidate("HOME_TOP");
    version = 1;
    const nearExpiry = await api.publicRead("HOME_TOP");
    await api.prepareArtwork("HOME_TOP", nearExpiry, 720, "active");
    assert.equal(loaded.length, 1, "near-expiry signed media is rejected by the preparer");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("failed background artwork can recover on an active visit without retry polling", async () => {
  let attempts = 0;
  const createImage = () => {
    const image = {
      fetchPriority: "auto",
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      decode: async () => undefined,
      set src(_value: string) {
        attempts += 1;
        queueMicrotask(() => (attempts === 1 ? image.onerror?.() : image.onload?.()));
      },
    };
    return image as unknown as HTMLImageElement;
  };
  globalThis.fetch = async () => response("WATCH_TOP");
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" }, { createImage });
    const data = await api.publicRead("WATCH_TOP");
    await assert.rejects(api.prepareArtwork("WATCH_TOP", data, 720, "background"));
    await api.prepareArtwork("WATCH_TOP", data, 720, "active");
    assert.equal(attempts, 2, "a later active visit retries once; no timer or polling is used");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("an active route promotes queued artwork above background image work", async () => {
  const loads: Array<{ image: HTMLImageElement; url: string; priority: string }> = [];
  const createImage = () => {
    const image = {
      fetchPriority: "auto",
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      decode: async () => undefined,
      set src(url: string) {
        loads.push({
          image: image as unknown as HTMLImageElement,
          url,
          priority: image.fetchPriority,
        });
      },
    };
    return image as unknown as HTMLImageElement;
  };
  globalThis.fetch = async (input) => {
    const placementId = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    return response(placementId);
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" }, { createImage });
    const watchData = await api.publicRead("WATCH_TOP");
    const teamsData = await api.publicRead("TEAMS_TOP");
    const backgroundWatch = api.prepareArtwork("WATCH_TOP", watchData, 720, "background");
    const backgroundTeams = api.prepareArtwork("TEAMS_TOP", teamsData, 720, "background");
    const activeTeams = api.prepareArtwork("TEAMS_TOP", teamsData, 720, "active");
    assert.equal(loads.length, 2, "the queued placement starts in the reserved active lane");
    assert.equal(loads[0]?.priority, "low");
    assert.equal(loads[1]?.url.includes("TEAMS_TOP"), true);
    assert.equal(loads[1]?.priority, "high");
    loads[1]!.image.onload?.(new Event("load"));
    await activeTeams;
    loads[0]!.image.onload?.(new Event("load"));
    await Promise.all([backgroundWatch, backgroundTeams]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("queued background artwork refreshes a signed URL that ages into the safety margin", async () => {
  const now = Date.now();
  const loads: Array<{ image: HTMLImageElement; url: string }> = [];
  const createImage = () => {
    const image = {
      fetchPriority: "auto",
      onload: null as ((event: Event) => void) | null,
      onerror: null as ((event: Event) => void) | null,
      decode: async () => undefined,
      set src(url: string) {
        loads.push({ image: image as unknown as HTMLImageElement, url });
      },
    };
    return image as unknown as HTMLImageElement;
  };
  let teamsReads = 0;
  globalThis.fetch = async (input) => {
    const placementId = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    if (placementId !== "TEAMS_TOP") return response(placementId);
    teamsReads += 1;
    const expiresAt = new Date(now + (teamsReads === 1 ? 90_000 : 300_000)).toISOString();
    return response(placementId, expiresAt);
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" }, { createImage });
    Date.now = () => now;
    const watch = await api.publicRead("WATCH_TOP");
    const teams = await api.publicRead("TEAMS_TOP");
    const watchPreparation = api.prepareArtwork("WATCH_TOP", watch, 720, "background");
    const teamsPreparation = api.prepareArtwork("TEAMS_TOP", teams, 720, "background");
    assert.equal(loads.length, 1, "only the first background image starts initially");
    Date.now = () => now + 40_000;
    loads[0]!.image.onload?.(new Event("load"));
    await watchPreparation;
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(teamsReads, 2, "the queued placement is force-refreshed once");
    assert.equal(loads.length, 2);
    assert.ok(!loads[1]!.url.includes(new Date(now + 90_000).toISOString()));
    loads[1]!.image.onload?.(new Event("load"));
    await teamsPreparation;
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

test("superseded concurrent reads release bounded slots for forced-fresh requests", async () => {
  const oldResolvers = new Map<string, (value: Response) => void>();
  const calls = new Map<string, number>();
  globalThis.fetch = (input) => {
    const placementId = new URL(String(input)).pathname.split("/").at(-1) ?? "";
    const count = (calls.get(placementId) ?? 0) + 1;
    calls.set(placementId, count);
    if (count === 1) {
      return new Promise((resolve) => oldResolvers.set(placementId, resolve));
    }
    return Promise.resolve(response(placementId));
  };
  try {
    const api = createPageBannerApi({ baseUrl: "http://api.test" });
    const placements = ["HOME_TOP", "PLAY_TOP", "WATCH_TOP"] as const;
    const oldReads = placements.map((placementId) => api.publicRead(placementId));
    const freshReads = placements.map((placementId) =>
      api.publicRead(placementId, { forceFresh: true }),
    );
    for (const placementId of placements) {
      oldResolvers.get(placementId)?.(response(placementId));
    }
    const fresh = await Promise.all(freshReads);
    const old = await Promise.all(oldReads);
    assert.deepEqual(old, fresh);
    assert.deepEqual([...calls.values()], [2, 2, 2]);
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
  let assetVersion = 1;
  const preparedUrls: string[] = [];
  const createImage = () => {
    const image = {
      fetchPriority: "auto",
      onload: null as (() => void) | null,
      onerror: null as (() => void) | null,
      decode: async () => undefined,
      set src(value: string) {
        preparedUrls.push(value);
        queueMicrotask(() => image.onload?.());
      },
    };
    return image as unknown as HTMLImageElement;
  };
  let reads = 0;
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/public/v1/banners/HOME_TOP") {
      reads += 1;
      return responseWithState(enabled, hasSlide);
    }
    if (init?.method === "PATCH" && path === "/api/v1/admin/banners/HOME_TOP") {
      enabled = Boolean(JSON.parse(String(init.body)).enabled);
    }
    if (init?.method === "PATCH" && path.endsWith("/slides/slide-1")) assetVersion += 1;
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
                    contentUrl: `https://media.test/HOME_TOP-${assetVersion}.webp?admin-state`,
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
    const publicApi = createPageBannerApi(transport, { createImage });
    const adminApi = createPlatformAdminApi(transport, {
      onPageBannerMutation: publicApi.invalidate,
    });
    const initiallyEnabled = await publicApi.publicRead("HOME_TOP");
    assert.equal(initiallyEnabled.enabled, true);
    await publicApi.prepareArtwork("HOME_TOP", initiallyEnabled, 720, "active");
    assert.deepEqual(preparedUrls, ["https://media.test/HOME_TOP-1.webp?admin-state"]);
    await adminApi.pageBanners.setEnabled("HOME_TOP", false);
    const disabled = await publicApi.publicRead("HOME_TOP");
    assert.equal(disabled.enabled, false);
    assert.equal(disabled.slides.length, 1);
    await publicApi.prepareArtwork("HOME_TOP", disabled, 720, "active");
    assert.equal(preparedUrls.length, 1, "disabled content is not prepared");
    await adminApi.pageBanners.setEnabled("HOME_TOP", true);
    const enabledAgain = await publicApi.publicRead("HOME_TOP");
    await adminApi.pageBanners.updateSlide("HOME_TOP", "slide-1", {
      isDecorative: true,
      altText: null,
      destination: null,
    });
    const replaced = await publicApi.publicRead("HOME_TOP");
    await publicApi.prepareArtwork("HOME_TOP", replaced, 720, "active");
    assert.deepEqual(preparedUrls, [
      "https://media.test/HOME_TOP-1.webp?admin-state",
      "https://media.test/HOME_TOP-2.webp?admin-state",
    ]);
    assert.equal(enabledAgain.enabled, true);
    await adminApi.pageBanners.deleteSlide("HOME_TOP", "slide-1");
    const deleted = await publicApi.publicRead("HOME_TOP");
    assert.equal(deleted.slides.length, 0);
    assert.equal(reads, 5);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
