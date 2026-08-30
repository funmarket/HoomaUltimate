import assert from "node:assert/strict";
import test from "node:test";
import {
  ExternalImageResolutionError,
  HttpExternalImageResolver,
  type ExternalImageFetcher,
  type ExternalImageHostLookup,
} from "../apps/api/src/infrastructure/media/http-external-image-resolver.js";

const publicLookup: ExternalImageHostLookup = async () => [{ address: "8.8.8.8", family: 4 }];

function resolverFor(
  handler: (url: URL) => Response | Promise<Response>,
  requested: string[] = [],
) {
  const fetcher = (async (input: string | URL | Request) => {
    const url = input instanceof URL ? input : new URL(typeof input === "string" ? input : input.url);
    requested.push(url.toString());
    return handler(url);
  }) as ExternalImageFetcher;
  return new HttpExternalImageResolver(fetcher, publicLookup, "HOOMA-Test/1.0");
}

test("direct image with a long query remains a concrete image URL", async () => {
  const requested: string[] = [];
  const longValue = "x".repeat(2500);
  const url = `https://images.example.com/photo.jpg?token=${longValue}`;
  const resolver = resolverFor(
    () => new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } }),
    requested,
  );

  assert.equal(await resolver.resolve(url), url);
  assert.deepEqual(requested, [url]);
});

test("HTML metadata is resolved relative to the page and the candidate is validated as image bytes", async () => {
  const requested: string[] = [];
  const resolver = resolverFor((url) => {
    if (url.pathname === "/place") {
      return new Response('<html><head><meta property="og:image" content="/media/full.webp"></head></html>', {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (url.pathname === "/media/full.webp") {
      return new Response(null, { status: 200, headers: { "content-type": "image/webp" } });
    }
    return new Response(null, { status: 404 });
  }, requested);

  assert.equal(
    await resolver.resolve("https://spots.example.com/place"),
    "https://spots.example.com/media/full.webp",
  );
  assert.deepEqual(requested, [
    "https://spots.example.com/place",
    "https://spots.example.com/media/full.webp",
  ]);
});

test("metadata image redirects are revalidated and return the final concrete image", async () => {
  const requested: string[] = [];
  const resolver = resolverFor((url) => {
    if (url.pathname === "/share") {
      return new Response('<meta name="twitter:image" content="https://cdn.example.com/preview">', {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url.hostname === "cdn.example.com" && url.pathname === "/preview") {
      return new Response(null, {
        status: 302,
        headers: { location: "https://cdn.example.com/full.png" },
      });
    }
    if (url.hostname === "cdn.example.com" && url.pathname === "/full.png") {
      return new Response(null, { status: 200, headers: { "content-type": "image/png" } });
    }
    return new Response(null, { status: 404 });
  }, requested);

  assert.equal(
    await resolver.resolve("https://events.example.com/share"),
    "https://cdn.example.com/full.png",
  );
  assert.deepEqual(requested, [
    "https://events.example.com/share",
    "https://cdn.example.com/preview",
    "https://cdn.example.com/full.png",
  ]);
});

test("a metadata candidate that is HTML is rejected instead of being persisted as an image", async () => {
  const resolver = resolverFor((url) => {
    if (url.pathname === "/share") {
      return new Response('<meta property="og:image" content="https://cdn.example.com/not-an-image">', {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    return new Response("<html>not an image</html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  });

  await assert.rejects(
    resolver.resolve("https://events.example.com/share"),
    (error: unknown) =>
      error instanceof ExternalImageResolutionError &&
      error.message === "Resolved image link does not return an image",
  );
});

test("Google image-result imgurl is unwrapped before fetching", async () => {
  const requested: string[] = [];
  const target = "https://origin.example.com/photos/cafe-thirteen.jpg?size=original";
  const google = `https://www.google.com/imgres?imgurl=${encodeURIComponent(target)}&imgrefurl=https%3A%2F%2Fexample.com`;
  const resolver = resolverFor(
    () => new Response(null, { status: 200, headers: { "content-type": "image/jpeg" } }),
    requested,
  );

  assert.equal(await resolver.resolve(google), target);
  assert.deepEqual(requested, [target]);
});

test("private hosts are rejected before any fetch", async () => {
  let fetched = false;
  const fetcher = (async () => {
    fetched = true;
    return new Response(null, { status: 200, headers: { "content-type": "image/png" } });
  }) as ExternalImageFetcher;
  const resolver = new HttpExternalImageResolver(fetcher, publicLookup);

  await assert.rejects(
    resolver.resolve("http://127.0.0.1/private.png"),
    (error: unknown) =>
      error instanceof ExternalImageResolutionError &&
      error.message === "Private or internal image hosts are not allowed",
  );
  assert.equal(fetched, false);
});

test("a public redirect cannot pivot to a private host", async () => {
  const requested: string[] = [];
  const resolver = resolverFor(
    () => new Response(null, { status: 302, headers: { location: "http://localhost/private.png" } }),
    requested,
  );

  await assert.rejects(
    resolver.resolve("https://public.example.com/start"),
    (error: unknown) =>
      error instanceof ExternalImageResolutionError &&
      error.message === "Private or internal image hosts are not allowed",
  );
  assert.deepEqual(requested, ["https://public.example.com/start"]);
});
