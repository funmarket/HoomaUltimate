import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHoomaApi } from "../packages/frontend/src/api.js";
import { resolveCommunityIdentityMediaUrl } from "../packages/frontend/src/communities/CommunityMedia.js";
import {
  CommunityIdentityInput,
  identitySelectionFromUrl,
  validateIdentitySelection,
  type CommunityIdentitySelection,
} from "../packages/frontend/src/communities/CommunityIdentityInputs.js";

const empty = (): CommunityIdentitySelection => ({ mode: "none", url: "", file: null });

test("Community logo/banner source controls expose one active input per slot", () => {
  for (const slot of ["logo", "banner"] as const) {
    const file = new File([Uint8Array.of(1, 2, 3)], `${slot}.png`, {
      type: "image/png",
    });
    const shared = {
      slot,
      previewUrl: null,
      disabled: false,
      onChange: () => undefined,
    };
    const external = renderToStaticMarkup(
      React.createElement(CommunityIdentityInput, {
        ...shared,
        selection: { mode: "external", url: "https://example.org/photo.png", file: null },
      }),
    );
    assert.match(external, /type="url"/);
    assert.doesNotMatch(external, /type="file"/);
    const upload = renderToStaticMarkup(
      React.createElement(CommunityIdentityInput, {
        ...shared,
        selection: { mode: "upload", url: "", file },
      }),
    );
    assert.match(upload, /type="file"/);
    assert.match(upload, /image\/jpeg,image\/png,image\/webp/);
    assert.doesNotMatch(upload, /type="url"/);
    const none = renderToStaticMarkup(
      React.createElement(CommunityIdentityInput, { ...shared, selection: empty() }),
    );
    assert.doesNotMatch(none, /type="file"|type="url"/);
  }
});

test("Community field hydration recognizes managed API path without treating it as external URL", () => {
  const path = "/api/public/v1/communities/community-1/identity/logo/content";
  const selection = identitySelectionFromUrl(path, "logo");
  assert.equal(selection.mode, "upload");
  assert.equal(selection.url, "");
  assert.equal(selection.file, null);
  assert.equal(identitySelectionFromUrl("https://example.org/pic.png", "logo").mode, "external");
  assert.equal(identitySelectionFromUrl(null, "banner").mode, "none");
});

test("Community client validation prevents competing sources, wrong MIME, oversized and empty uploads", () => {
  assert.equal(validateIdentitySelection(empty(), "logo", false), null);
  assert.match(
    validateIdentitySelection(
      { mode: "external", url: "ftp://example.org/pic.png", file: null },
      "logo",
      false,
    ) ?? "",
    /HTTP/i,
  );
  assert.match(
    validateIdentitySelection({ mode: "external", url: "", file: null }, "banner", false) ?? "",
    /HTTP/i,
  );
  assert.match(
    validateIdentitySelection(
      { mode: "upload", url: "https://example.org/ignored.png", file: null },
      "banner",
      false,
    ) ?? "",
    /file/i,
  );
  assert.equal(
    validateIdentitySelection({ mode: "upload", url: "", file: null }, "logo", true),
    null,
  );
  const png = new File([Uint8Array.of(1)], "image.png", { type: "image/png" });
  assert.equal(
    validateIdentitySelection({ mode: "upload", url: "", file: png }, "logo", false),
    null,
  );
  const gif = new File([Uint8Array.of(1)], "image.gif", { type: "image/gif" });
  assert.match(
    validateIdentitySelection({ mode: "upload", url: "", file: gif }, "logo", false) ?? "",
    /JPEG|PNG|WebP/,
  );
  const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
    type: "image/png",
  });
  assert.match(
    validateIdentitySelection({ mode: "upload", url: "", file: oversized }, "logo", false) ?? "",
    /5 MiB/,
  );
});

test("Community frontend API sends raw uploaded File to the exact Community route", async () => {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; body: BodyInit | null | undefined; contentType: string }> = [];
  globalThis.fetch = async (url, init) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(url),
      body: init?.body,
      contentType: headers.get("content-type") ?? "",
    });
    return Response.json({ mediaId: "managed-1" }, { status: 201 });
  };
  try {
    const api = createHoomaApi({ baseUrl: "https://api.example.org", credentials: "include" });
    const file = new File([Uint8Array.of(1, 2, 3)], "logo.png", { type: "image/png" });
    const response = await api.communities.uploadIdentity("community-1", "logo", file);
    assert.equal(response.mediaId, "managed-1");
    assert.equal(calls.length, 1);
    assert.equal(
      calls[0]?.url,
      "https://api.example.org/api/v1/communities/community-1/identity/logo/upload",
    );
    assert.equal(calls[0]?.body, file);
    assert.equal(calls[0]?.contentType, "image/png");
  } finally {
    globalThis.fetch = original;
  }
});

test("Community managed image URLs follow the configured API origin, external and blob URLs do not", () => {
  const relative = "/api/public/v1/communities/c-one/identity/logo/content";
  assert.equal(
    resolveCommunityIdentityMediaUrl(relative, "http://localhost:3000"),
    "http://localhost:3000/api/public/v1/communities/c-one/identity/logo/content",
  );
  assert.equal(resolveCommunityIdentityMediaUrl(relative, ""), relative);
  assert.equal(
    resolveCommunityIdentityMediaUrl("https://img.example.org/logo.png", "https://api.example.org"),
    "https://img.example.org/logo.png",
  );
  assert.equal(
    resolveCommunityIdentityMediaUrl("blob:http://localhost:5173/photo", "http://localhost:3000"),
    "blob:http://localhost:5173/photo",
  );
  assert.equal(resolveCommunityIdentityMediaUrl(null, "http://localhost:3000"), null);
});
