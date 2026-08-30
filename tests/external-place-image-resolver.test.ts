import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../apps/api/src/http/errors/app-error.js";
import { HttpExternalPlaceImageResolver } from "../apps/api/src/modules/places/infrastructure/http-external-place-image-resolver.js";

const publicLookup = async () => [{ address: "93.184.216.34", family: 4 }] as const;

function fetcher(handler: (url: URL) => Response | Promise<Response>): typeof fetch {
  return (async (input: string | URL | Request) => handler(new URL(String(input)))) as typeof fetch;
}

test("external Place image resolver keeps a direct image URL without fetching it", async () => {
  let fetchCalls = 0;
  const resolver = new HttpExternalPlaceImageResolver(
    fetcher(() => {
      fetchCalls += 1;
      return new Response(null, { status: 500 });
    }),
    publicLookup,
  );

  const result = await resolver.resolve("https://cdn.example.com/cafe-thirteen.jpg");
  assert.equal(result, "https://cdn.example.com/cafe-thirteen.jpg");
  assert.equal(fetchCalls, 0);
});

test("external Place image resolver extracts og:image from ordinary pages", async () => {
  const resolver = new HttpExternalPlaceImageResolver(
    fetcher(
      () =>
        new Response(
          '<html><head><meta property="og:image" content="/media/venue.webp"></head></html>',
          {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          },
        ),
    ),
    publicLookup,
  );

  const result = await resolver.resolve("https://example.com/cafe-thirteen");
  assert.equal(result, "https://example.com/media/venue.webp");
});

test("external Place image resolver follows public redirects before resolving metadata", async () => {
  const resolver = new HttpExternalPlaceImageResolver(
    fetcher((url) => {
      if (url.hostname === "short.example.com") {
        return new Response(null, {
          status: 302,
          headers: { location: "https://page.example.com/place" },
        });
      }
      return new Response(
        '<meta name="twitter:image" content="https://cdn.example.com/place.png">',
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      );
    }),
    publicLookup,
  );

  const result = await resolver.resolve("https://short.example.com/share/123");
  assert.equal(result, "https://cdn.example.com/place.png");
});

test("external Place image resolver extracts a selected image from Google result HTML", async () => {
  const resolver = new HttpExternalPlaceImageResolver(
    fetcher(
      () =>
        new Response(
          '<a href="/imgres?imgurl=https%3A%2F%2Fcdn.example.com%2Fcafe.jpg&amp;imgrefurl=https%3A%2F%2Fexample.com">result</a>',
          { status: 200, headers: { "content-type": "text/html" } },
        ),
    ),
    publicLookup,
  );

  const result = await resolver.resolve("https://www.google.com/search?tbm=isch&q=cafe+thirteen");
  assert.equal(result, "https://cdn.example.com/cafe.jpg");
});

test("external Place image resolver rejects private-network destinations before fetching", async () => {
  let fetchCalls = 0;
  const resolver = new HttpExternalPlaceImageResolver(
    fetcher(() => {
      fetchCalls += 1;
      return new Response(null, { status: 200 });
    }),
    async () => [{ address: "127.0.0.1", family: 4 }],
  );

  await assert.rejects(
    () => resolver.resolve("https://internal.example/photo"),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 422 &&
      error.code === "PLACE_IMAGE_URL_UNRESOLVABLE",
  );
  assert.equal(fetchCalls, 0);
});

test("external Place image resolver revalidates redirect destinations against SSRF", async () => {
  const resolver = new HttpExternalPlaceImageResolver(
    fetcher(
      () => new Response(null, { status: 302, headers: { location: "http://127.0.0.1/photo" } }),
    ),
    publicLookup,
  );

  await assert.rejects(
    () => resolver.resolve("https://public.example/redirect"),
    (error: unknown) => error instanceof AppError && error.code === "PLACE_IMAGE_URL_UNRESOLVABLE",
  );
});
