import assert from "node:assert/strict";
import test from "node:test";
import {
  createArtworkPreparation,
  reuseArtworkUrls,
} from "../packages/frontend/src/page-banner/artwork.ts";
import type { PageBannerPublicResponse } from "../packages/frontend/src/page-banner/api.ts";

function response(
  placementId = "HOME_TOP",
  suffix = "one",
  artworkVersion: string | undefined = "media-one",
): PageBannerPublicResponse {
  return {
    placementId: placementId as never,
    enabled: true,
    slides: [
      {
        id: "same-slide",
        ...(artworkVersion ? { artworkVersion } : {}),
        sortOrder: 0,
        isDecorative: true,
        altText: null,
        destination: null,
        variants: [
          {
            variant: "mobile",
            contentUrl: `https://media.test/${placementId}-${suffix}.webp`,
            expiresAt: new Date(Date.now() + 300_000).toISOString(),
            contentType: "image/webp",
            widthPx: 720,
            heightPx: 300,
          },
        ],
      },
    ],
  };
}

function images() {
  const created: HTMLImageElement[] = [];
  const requests: string[] = [];
  return {
    created,
    requests,
    createImage() {
      let url = "";
      const image = {
        onload: null,
        onerror: null,
        complete: false,
        naturalWidth: 0,
        decode: () => Promise.resolve(),
        removeAttribute() {
          url = "";
        },
        get src() {
          return url;
        },
        set src(value: string) {
          url = value;
          requests.push(value);
        },
      } as unknown as HTMLImageElement;
      created.push(image);
      return image;
    },
  };
}

test("preparation deduplicates one URL, serializes background work and starts active artwork immediately", async () => {
  const fake = images();
  const resources = createArtworkPreparation({ createImage: fake.createImage });
  const home = resources.prepare(response(), 390, "background");
  assert.equal(resources.prepare(response(), 390, "background"), home);
  const play = resources.prepare(response("PLAY_TOP"), 390, "background");
  const watch = resources.prepare(response("WATCH_TOP"), 390, "active");
  assert.deepEqual(fake.requests, [
    "https://media.test/HOME_TOP-one.webp",
    "https://media.test/WATCH_TOP-one.webp",
  ]);
  fake.created[2]!.onload?.(new Event("load"));
  await watch;
  fake.created[0]!.onload?.(new Event("load"));
  await home;
  assert.equal(fake.requests[2], "https://media.test/PLAY_TOP-one.webp");
  fake.created[1]!.onload?.(new Event("load"));
  await play;
  resources.clear();
});

test("invalidation settles queued work and late decoding cannot revive replaced resources", async () => {
  const fake = images();
  const resources = createArtworkPreparation({ createImage: fake.createImage });
  let finishDecode!: () => void;
  const first = resources.prepare(response(), 390, "background");
  fake.created[0]!.decode = () =>
    new Promise<void>((resolve) => {
      finishDecode = resolve;
    });
  fake.created[0]!.onload?.(new Event("load"));
  const queued = resources.prepare(response("PLAY_TOP"), 390, "background");
  resources.invalidate("PLAY_TOP");
  await queued;
  resources.invalidate("HOME_TOP");
  await first;
  const next = resources.prepare(response("HOME_TOP", "two", "media-two"), 390, "active");
  finishDecode();
  await Promise.resolve();
  assert.equal(fake.requests.length, 2);
  fake.created[2]!.onload?.(new Event("load"));
  await next;
  resources.clear();
});

test("failed artwork is retried and background timeout releases the next image", async () => {
  const fake = images();
  const resources = createArtworkPreparation({ createImage: fake.createImage, timeoutMs: 20 });
  const first = resources.prepare(response(), 390, "background");
  const failed = assert.rejects(first, /timed out/);
  const next = resources.prepare(response("PLAY_TOP"), 390, "background");
  await failed;
  assert.equal(fake.requests.length, 2);
  fake.created[1]!.onload?.(new Event("load"));
  await next;
  const retry = resources.prepare(response(), 390, "active");
  fake.created[2]!.onload?.(new Event("load"));
  await retry;
  resources.clear();
});

test("URL reuse does not guess missing versions, cross variants, or extend original signature expiry", () => {
  const old = response();
  const next = response("HOME_TOP", "two");
  next.slides[0]!.variants[0]!.expiresAt = new Date(Date.now() + 600_000).toISOString();
  const same = reuseArtworkUrls(old, next, Date.now());
  assert.equal(same.slides[0]!.variants[0]!.expiresAt, old.slides[0]!.variants[0]!.expiresAt);
  const missing = response("HOME_TOP", "two", "");
  assert.equal(
    reuseArtworkUrls(old, missing, Date.now()).slides[0]!.variants[0]!.contentUrl,
    missing.slides[0]!.variants[0]!.contentUrl,
  );
  assert.equal(
    reuseArtworkUrls(old, next, Date.now() + 240_000).slides[0]!.variants[0]!.contentUrl,
    next.slides[0]!.variants[0]!.contentUrl,
  );
});

test("clearing resources cancels queued images without starting their network requests", async () => {
  const fake = images();
  const resources = createArtworkPreparation({ createImage: fake.createImage });
  const active = resources.prepare(response(), 390, "background");
  const queued = resources.prepare(response("PLAY_TOP"), 390, "background");
  resources.clear();
  await Promise.all([active, queued]);
  assert.equal(fake.requests.length, 1);
});

test("reused URLs require matching artwork identity, placement and complete variant descriptors", () => {
  const old = response();
  for (const change of [
    (value: PageBannerPublicResponse) => {
      value.placementId = "PLAY_TOP";
    },
    (value: PageBannerPublicResponse) => {
      value.slides[0]!.id = "different-slide";
    },
    (value: PageBannerPublicResponse) => {
      value.slides[0]!.artworkVersion = "new-artwork";
    },
    (value: PageBannerPublicResponse) => {
      value.slides[0]!.variants[0]!.variant = "display";
    },
    (value: PageBannerPublicResponse) => {
      value.slides[0]!.variants[0]!.widthPx = 1440;
    },
    (value: PageBannerPublicResponse) => {
      value.slides[0]!.variants[0]!.heightPx = 600;
    },
    (value: PageBannerPublicResponse) => {
      value.slides[0]!.variants[0]!.contentType = "image/png";
    },
  ]) {
    const next = response("HOME_TOP", "new-url");
    change(next);
    assert.equal(
      reuseArtworkUrls(old, next, Date.now()).slides[0]!.variants[0]!.contentUrl,
      "https://media.test/HOME_TOP-new-url.webp",
    );
  }
});

test("a queued image is promoted immediately when it becomes the active placement", async () => {
  const fake = images();
  const resources = createArtworkPreparation({ createImage: fake.createImage });
  const home = resources.prepare(response(), 390, "background");
  const play = resources.prepare(response("PLAY_TOP"), 390, "background");
  assert.equal(fake.requests.length, 1);
  assert.equal(resources.prepare(response("PLAY_TOP"), 390, "active"), play);
  assert.equal(fake.requests.length, 2);
  assert.equal(fake.created[1]!.fetchPriority, "high");
  fake.created[1]!.onload?.(new Event("load"));
  fake.created[0]!.onload?.(new Event("load"));
  await Promise.all([home, play]);
  resources.clear();
});

test("decode rejection releases preparation and permits a later attempt", async () => {
  const fake = images();
  const resources = createArtworkPreparation({ createImage: fake.createImage });
  const first = resources.prepare(response(), 390, "active");
  fake.created[0]!.decode = async () => {
    throw new Error("bad bytes");
  };
  const rejected = assert.rejects(first, /decode failed/);
  fake.created[0]!.onload?.(new Event("load"));
  await rejected;
  const next = resources.prepare(response(), 390, "active");
  assert.equal(fake.requests.length, 2);
  fake.created[1]!.onload?.(new Event("load"));
  await next;
  resources.clear();
});

test("retention evicts and settles the oldest preparation beyond eleven placements", async () => {
  const fake = images();
  const resources = createArtworkPreparation({ createImage: fake.createImage });
  const pending = Array.from({ length: 12 }, (_, index) =>
    resources.prepare(response(`PLACEMENT_${index}`), 390, "background"),
  );
  await pending[0];
  assert.equal(fake.created[0]!.onload, null);
  assert.equal(fake.requests.length, 2);
  resources.clear();
  await Promise.all(pending);
});
