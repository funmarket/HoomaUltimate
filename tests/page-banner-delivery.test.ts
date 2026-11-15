import assert from "node:assert/strict";
import test from "node:test";
import { PageBannerService } from "../apps/api/src/modules/page-banner/application/page-banner.service.ts";
import type { PageBannerRepository } from "../apps/api/src/modules/page-banner/application/page-banner.repository.ts";
import { createPageBannerApi } from "../packages/frontend/src/page-banner/api.ts";

function fixture() {
  const slide = {
    id: "slide-one",
    placementId: "HOME_TOP" as const,
    mediaId: "version-one",
    sortOrder: 0,
    enabled: true,
    isDecorative: true,
    altText: null,
    destinationKind: null,
    destinationUrl: null,
    variants: [
      {
        variant: "mobile",
        objectKey: "private/current.webp",
        contentType: "image/webp",
        sizeBytes: 3,
        widthPx: 720,
        heightPx: 300,
      },
    ],
  };
  const placement = { id: "HOME_TOP" as const, enabled: true, slides: [slide] };
  const repository = { get: async () => placement } as unknown as PageBannerRepository;
  const storage = {
    createReadUrl: async () => "https://storage.test/signed",
    get: async (key: string) => {
      assert.equal(key, "private/current.webp");
      return { key, body: new Uint8Array([1, 2, 3]), contentType: "image/webp", sizeBytes: 3 };
    },
  };
  const service = new PageBannerService(repository, {} as never, storage as never, "staging");
  return { service, placement, slide };
}

test("public artwork identity is stable across reads and changes on actual media replacement", async () => {
  const { service, slide } = fixture();
  const first = await service.publicRead("HOME_TOP");
  assert.equal(
    first.slides[0]?.variants[0]?.contentUrl,
    "/api/public/v1/banners/HOME_TOP/artwork/version-one/mobile.webp",
  );
  assert.equal(first.slides[0]?.variants[0]?.delivery, "IMMUTABLE");
  assert.equal(first.slides[0]?.variants[0]?.expiresAt, null);
  assert.equal(
    (await service.publicRead("HOME_TOP")).slides[0]?.variants[0]?.contentUrl,
    first.slides[0]?.variants[0]?.contentUrl,
  );
  slide.mediaId = "version-two";
  assert.equal(
    (await service.publicRead("HOME_TOP")).slides[0]?.variants[0]?.contentUrl,
    "/api/public/v1/banners/HOME_TOP/artwork/version-two/mobile.webp",
  );
});

test("public bytes resolve only the enabled current placement, slide, media version and variant", async () => {
  const { service, placement, slide } = fixture();
  assert.deepEqual(
    (await service.publicArtwork("HOME_TOP", "version-one", "mobile.webp")).body,
    new Uint8Array([1, 2, 3]),
  );
  for (const [media, variant] of [
    ["old-version", "mobile.webp"],
    ["version-one", "../../private"],
    ["version-one", "master.webp"],
  ]) {
    await assert.rejects(service.publicArtwork("HOME_TOP", media!, variant!), { status: 404 });
  }
  slide.enabled = false;
  await assert.rejects(service.publicArtwork("HOME_TOP", "version-one", "mobile.webp"), {
    status: 404,
  });
  slide.enabled = true;
  placement.enabled = false;
  await assert.rejects(service.publicArtwork("HOME_TOP", "version-one", "mobile.webp"), {
    status: 404,
  });
  placement.enabled = true;
  placement.slides = [];
  await assert.rejects(service.publicArtwork("HOME_TOP", "version-one", "mobile.webp"), {
    status: 404,
  });
});

test("immutable delivery has no fake signature expiry while fresh metadata still controls reuse", async () => {
  const { service, placement, slide } = fixture();
  const original = globalThis.fetch;
  const now = Date.now;
  let time = now();
  let reads = 0;
  Date.now = () => time;
  globalThis.fetch = async () => {
    reads++;
    return Response.json(await service.publicRead("HOME_TOP"));
  };
  try {
    const api = createPageBannerApi({ baseUrl: "https://api.test" });
    const first = await api.publicRead("HOME_TOP", { forceFresh: true });
    assert.equal(
      first.slides[0]?.variants[0]?.contentUrl,
      "https://api.test/api/public/v1/banners/HOME_TOP/artwork/version-one/mobile.webp",
    );
    assert.equal(await api.publicRead("HOME_TOP"), first);
    assert.equal(reads, 1);
    time += 16_000;
    slide.mediaId = "version-two";
    assert.match(
      (await api.publicRead("HOME_TOP")).slides[0]!.variants[0]!.contentUrl,
      /version-two/,
    );
    assert.equal(reads, 2);
    time += 16_000;
    placement.enabled = false;
    assert.deepEqual((await api.publicRead("HOME_TOP")).slides, []);
    assert.equal(reads, 3);
  } finally {
    globalThis.fetch = original;
    Date.now = now;
  }
});

test("immutable descriptors cannot smuggle a signed expiry past validation", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      placementId: "HOME_TOP",
      enabled: true,
      slides: [
        {
          id: "slide",
          variants: [
            {
              delivery: "IMMUTABLE",
              contentUrl: "/api/public/v1/banners/HOME_TOP/artwork/v/mobile.webp",
              expiresAt: new Date(Date.now() + 300_000).toISOString(),
              widthPx: 720,
              heightPx: 300,
              contentType: "image/webp",
              variant: "mobile",
            },
          ],
        },
      ],
    });
  try {
    await assert.rejects(
      createPageBannerApi({ baseUrl: "https://api.test" }).publicRead("HOME_TOP", {
        forceFresh: true,
      }),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("immutable public image headers permit embedding and metadata policy stays inside PageBanner", async () => {
  const { default: express } = await import("express");
  const { default: helmet } = await import("helmet");
  const { createPageBannerPublicRouter } =
    await import("../apps/api/src/modules/page-banner/http/page-banner.routes.ts");
  const { service } = fixture();
  const app = express();
  app.use(helmet());
  app.use("/api/public/v1", createPageBannerPublicRouter(service));
  app.get("/api/public/v1/another-domain", (_request, response) => response.json({ ok: true }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  try {
    const other = await fetch(origin + "/api/public/v1/another-domain");
    await other.text();
    assert.equal(other.headers.get("cache-control"), null);
    const legacyMetadata = await (await fetch(origin + "/api/public/v1/banners/HOME_TOP")).json();
    assert.equal(legacyMetadata.slides[0].variants[0].contentUrl, "https://storage.test/signed");
    const modernResponse = await fetch(origin + "/api/public/v1/banners/HOME_TOP", {
      headers: { "X-Hooma-PageBanner-Delivery": "immutable" },
    });
    assert.equal(modernResponse.headers.get("cache-control"), "no-store");
    assert.match(modernResponse.headers.get("vary")!, /X-Hooma-PageBanner-Delivery/i);
    assert.equal((await modernResponse.json()).slides[0].variants[0].expiresAt, null);

    const image = await fetch(
      origin + "/api/public/v1/banners/HOME_TOP/artwork/version-one/mobile.webp",
    );
    await image.arrayBuffer();
    assert.equal(image.headers.get("cross-origin-resource-policy"), "cross-origin");
    assert.equal(image.headers.get("cache-control"), "public, max-age=31536000, immutable");
    const conditional = await fetch(
      origin + "/api/public/v1/banners/HOME_TOP/artwork/version-one/mobile.webp",
      {
        headers: { "if-none-match": image.headers.get("etag")! },
      },
    );
    assert.equal(conditional.status, 304);
    assert.equal((await conditional.arrayBuffer()).byteLength, 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("existing clients can retain signed delivery during a rolling frontend deployment", async () => {
  const { service } = fixture();
  const legacy = await service.publicRead("HOME_TOP", "SIGNED");
  assert.equal(legacy.slides[0]!.variants[0]!.contentUrl, "https://storage.test/signed");
  assert.equal(typeof legacy.slides[0]!.variants[0]!.expiresAt, "string");
  assert.equal(legacy.slides[0]!.variants[0]!.delivery, "SIGNED");
});
