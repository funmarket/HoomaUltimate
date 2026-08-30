import assert from "node:assert/strict";
import test from "node:test";
import {
  ExternalImageResolutionError,
  HttpExternalImageResolver,
  type ExternalImageFetcher,
  type ExternalImageHostLookup,
} from "../apps/api/src/infrastructure/media/http-external-image-resolver.js";

const publicLookup: ExternalImageHostLookup = async () => [
  { address: "8.8.8.8", family: 4 },
];

function imageResponse(type = "image/jpeg") {
  return new Response(null, {
    status: 200,
    headers: { "content-type": type },
  });
}

function resolverFor(
  handler: (url: URL) => Response | Promise<Response>,
  requested: string[] = [],
) {
  const fetcher = (async (input: string | URL | Request) => {
    const url =
      input instanceof URL
        ? input
        : new URL(typeof input === "string" ? input : input.url);
    requested.push(url.toString());
    return handler(url);
  }) as ExternalImageFetcher;
  return new HttpExternalImageResolver(
    fetcher,
    publicLookup,
    "HOOMA-Test/1.0",
  );
}

test("direct image keeps a long query URL", async () => {
  const requested: string[] = [];
  const longValue = "x".repeat(2500);
  const url = `https://img.example/photo.jpg?token=${longValue}`;
  const resolver = resolverFor(() => imageResponse(), requested);

  assert.equal(await resolver.resolve(url), url);
  assert.deepEqual(requested, [url]);
});

test("HTML metadata resolves and validates an image", async () => {
  const requested: string[] = [];
  const resolver = resolverFor((url) => {
    if (url.pathname === "/place") {
      const html = '<meta property="og:image" content="/full.webp">';
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url.pathname === "/full.webp") {
      return imageResponse("image/webp");
    }
    return new Response(null, { status: 404 });
  }, requested);

  const page = "https://spots.example/place";
  const image = "https://spots.example/full.webp";
  assert.equal(await resolver.resolve(page), image);
  assert.deepEqual(requested, [page, image]);
});

test("metadata image redirects are revalidated", async () => {
  const requested: string[] = [];
  const resolver = resolverFor((url) => {
    if (url.pathname === "/share") {
      const html = [
        '<meta name="twitter:image"',
        'content="https://cdn.example/preview">',
      ].join(" ");
      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }
    if (url.pathname === "/preview") {
      return new Response(null, {
        status: 302,
        headers: { location: "https://cdn.example/full.png" },
      });
    }
    if (url.pathname === "/full.png") {
      return imageResponse("image/png");
    }
    return new Response(null, { status: 404 });
  }, requested);

  const page = "https://events.example/share";
  const preview = "https://cdn.example/preview";
  const image = "https://cdn.example/full.png";
  assert.equal(await resolver.resolve(page), image);
  assert.deepEqual(requested, [page, preview, image]);
});

test("HTML metadata candidate is rejected as an image", async () => {
  const resolver = resolverFor((url) => {
    if (url.pathname === "/share") {
      const html = [
        '<meta property="og:image"',
        'content="https://cdn.example/not-image">',
      ].join(" ");
      return new Response(html, {
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
    resolver.resolve("https://events.example/share"),
    (error: unknown) =>
      error instanceof ExternalImageResolutionError &&
      error.message === "Resolved image link does not return an image",
  );
});

test("Google imgurl unwraps before fetch", async () => {
  const requested: string[] = [];
  const target = "https://origin.example/cafe.jpg?size=original";
  const query = new URLSearchParams({
    imgurl: target,
    imgrefurl: "https://source.example",
  });
  const google = `https://www.google.com/imgres?${query}`;
  const resolver = resolverFor(() => imageResponse(), requested);

  assert.equal(await resolver.resolve(google), target);
  assert.deepEqual(requested, [target]);
});

test("private hosts are rejected before fetch", async () => {
  let fetched = false;
  const fetcher = (async () => {
    fetched = true;
    return imageResponse("image/png");
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

test("public redirect cannot pivot to a private host", async () => {
  const requested: string[] = [];
  const resolver = resolverFor(() => {
    return new Response(null, {
      status: 302,
      headers: { location: "http://localhost/private.png" },
    });
  }, requested);

  await assert.rejects(
    resolver.resolve("https://public.example/start"),
    (error: unknown) =>
      error instanceof ExternalImageResolutionError &&
      error.message === "Private or internal image hosts are not allowed",
  );
  assert.deepEqual(requested, ["https://public.example/start"]);
});
