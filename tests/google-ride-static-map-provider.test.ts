import assert from "node:assert/strict";
import test from "node:test";
import {\n  GoogleRideStaticMapProvider,\n} from "../apps/api/src/modules/rides/infrastructure/google-ride-static-map-provider.js";

test("Google Ride static map provider renders public destination with Google map parameters", async () => {
  let requestedUrl: URL | null = null;
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return new Response(Uint8Array.of(1, 2, 3), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  };
  const provider = new GoogleRideStaticMapProvider({ apiKey: "google-test-key", fetcher });

  const image = await provider.renderPublicDestinationMap({
    searchText: "Stade Olympique de Rades",
  });

  assert.equal(image?.contentType, "image/png");
  assert.deepEqual(image ? [...image.body] : null, [1, 2, 3]);
  assert.equal(requestedUrl?.origin, "https://maps.googleapis.com");
  assert.equal(requestedUrl?.pathname, "/maps/api/staticmap");
  assert.equal(requestedUrl?.searchParams.get("center"), "Stade Olympique de Rades");
  assert.equal(requestedUrl?.searchParams.get("zoom"), "13");
  assert.equal(requestedUrl?.searchParams.get("size"), "640x360");
  assert.equal(requestedUrl?.searchParams.get("scale"), "2");
  assert.equal(requestedUrl?.searchParams.get("maptype"), "roadmap");
  assert.equal(
    requestedUrl?.searchParams.get("markers"),
    "color:0xd9bf71|Stade Olympique de Rades",
  );
  assert.equal(requestedUrl?.searchParams.get("key"), "google-test-key");
});

test("Google Ride static map provider renders private meeting point from exact coordinates", async () => {
  let requestedUrl: URL | null = null;
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return new Response(Uint8Array.of(4, 5, 6), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  };
  const provider = new GoogleRideStaticMapProvider({ apiKey: "google-test-key", fetcher });

  const image = await provider.renderPrivateMeetingPointMap({
    coordinates: { latitude: 36.8065, longitude: 10.1815 },
  });

  assert.equal(image?.contentType, "image/png");
  assert.deepEqual(image ? [...image.body] : null, [4, 5, 6]);
  assert.equal(requestedUrl?.searchParams.get("center"), "36.8065,10.1815");
  assert.equal(requestedUrl?.searchParams.get("zoom"), "16");
  assert.equal(
    requestedUrl?.searchParams.get("markers"),
    "color:0xc7f46b|36.8065,10.1815",
  );
});

test("Google Ride static map provider returns null on unavailable or invalid map responses", async () => {
  const unavailable = new GoogleRideStaticMapProvider({
    apiKey: "google-test-key",
    fetcher: async () => new Response("unavailable", { status: 503 }),
  });
  assert.equal(
    await unavailable.renderPublicDestinationMap({ searchText: "Hammamet, Tunisia" }),
    null,
  );

  const nonImage = new GoogleRideStaticMapProvider({
    apiKey: "google-test-key",
    fetcher: async () =>
      new Response("not an image", {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
  });
  assert.equal(
    await nonImage.renderPublicDestinationMap({ searchText: "Hammamet, Tunisia" }),
    null,
  );

  const failed = new GoogleRideStaticMapProvider({
    apiKey: "google-test-key",
    fetcher: async () => {
      throw new Error("network failure");
    },
  });
  assert.equal(await failed.renderPublicDestinationMap({ searchText: "Hammamet" }), null);
  assert.equal(await failed.renderPrivateMeetingPointMap({ coordinates: null }), null);
});
