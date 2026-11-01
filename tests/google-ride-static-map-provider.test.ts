import assert from "node:assert/strict";
import test from "node:test";
import {
  GoogleRideStaticMapProvider,
} from "../apps/api/src/modules/rides/infrastructure/google-ride-static-map-provider.js";

test("Google Ride map renders a public destination", async () => {
  let requestedUrl: URL | null = null;
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return new Response(Uint8Array.of(1, 2, 3), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  };
  const provider = new GoogleRideStaticMapProvider({
    apiKey: "google-test-key",
    fetcher,
  });

  const image = await provider.renderPublicDestinationMap({
    searchText: "Stade Olympique de Rades",
  });

  assert.equal(image?.contentType, "image/png");
  assert.equal(requestedUrl?.searchParams.get("zoom"), "13");
  assert.equal(requestedUrl?.searchParams.get("size"), "640x360");
  assert.equal(requestedUrl?.searchParams.get("scale"), "2");
  assert.equal(
    requestedUrl?.searchParams.get("center"),
    "Stade Olympique de Rades",
  );
  assert.equal(
    requestedUrl?.searchParams.get("markers"),
    "color:0xd9bf71|Stade Olympique de Rades",
  );
  assert.equal(requestedUrl?.searchParams.get("key"), "google-test-key");
});

test("Google Ride map renders private coordinates", async () => {
  let requestedUrl: URL | null = null;
  const fetcher: typeof fetch = async (input) => {
    requestedUrl = new URL(String(input));
    return new Response(Uint8Array.of(4, 5, 6), {
      status: 200,
      headers: { "content-type": "image/png" },
    });
  };
  const provider = new GoogleRideStaticMapProvider({
    apiKey: "google-test-key",
    fetcher,
  });

  await provider.renderPrivateMeetingPointMap({
    coordinates: { latitude: 36.8065, longitude: 10.1815 },
  });

  assert.equal(
    requestedUrl?.searchParams.get("center"),
    "36.8065,10.1815",
  );
  assert.equal(requestedUrl?.searchParams.get("zoom"), "16");
  assert.equal(
    requestedUrl?.searchParams.get("markers"),
    "color:green|36.8065,10.1815",
  );
});

test("Google Ride map returns null when Google fails", async () => {
  const provider = new GoogleRideStaticMapProvider({
    apiKey: "google-test-key",
    fetcher: async () => {
      throw new Error("network failure");
    },
  });

  const image = await provider.renderPublicDestinationMap({
    searchText: "Hammamet, Tunisia",
  });

  assert.equal(image, null);
});
