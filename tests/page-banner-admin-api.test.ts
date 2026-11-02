import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformAdminApi } from "../packages/frontend/src/platform-admin/api.ts";

test("Platform Admin PageBanner API uses the merged backend routes and metadata contract", async () => {
  const requests: Array<{ path: string; method: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    requests.push({
      path: new URL(String(input)).pathname + new URL(String(input)).search,
      method: init?.method ?? "GET",
      body: init?.body,
    });
    return new Response(JSON.stringify({ id: "HOME_TOP", enabled: true, slides: [] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    const api = createPlatformAdminApi({ baseUrl: "http://api.test" });
    await api.pageBanners.list();
    await api.pageBanners.setEnabled("HOME_TOP", true);
    await api.pageBanners.upload("HOME_TOP", new Blob(["image"], { type: "image/png" }), {
      enabled: true,
      isDecorative: false,
      altText: "Home banner",
      destination: { kind: "EXTERNAL", url: "https://example.com" },
    });
    await api.pageBanners.reorder("HOME_TOP", ["slide-1"]);
    await api.pageBanners.deleteSlide("HOME_TOP", "slide-1");

    assert.deepEqual(
      requests.map(({ path, method }) => [method, path]),
      [
        ["GET", "/api/v1/admin/banners"],
        ["PATCH", "/api/v1/admin/banners/HOME_TOP"],
        [
          "POST",
          "/api/v1/admin/banners/HOME_TOP/slides/upload?enabled=true&isDecorative=false&altText=Home+banner&destinationKind=EXTERNAL&destinationUrl=https%3A%2F%2Fexample.com",
        ],
        ["POST", "/api/v1/admin/banners/HOME_TOP/slides/reorder"],
        ["DELETE", "/api/v1/admin/banners/HOME_TOP/slides/slide-1"],
      ],
    );
    assert.equal(requests[1]?.body, JSON.stringify({ enabled: true }));
    assert.equal(requests[2]?.body instanceof Blob, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
