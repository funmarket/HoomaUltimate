import assert from "node:assert/strict";
import test from "node:test";
import {
  REQUEST_IMAGE_CONTENT_TYPES,
  REQUEST_IMAGE_MAX_BYTES,
  helpRequestExternalImageInputSchema,
  helpRequestImageDeliverySchema,
  helpRequestImageSchema,
} from "@hooma/contracts/requests";

test("Request media contract normalizes uploaded and external images without exposing storage keys", () => {
  assert.deepEqual(REQUEST_IMAGE_CONTENT_TYPES, ["image/jpeg", "image/png", "image/webp"]);
  assert.equal(REQUEST_IMAGE_MAX_BYTES, 5 * 1024 * 1024);

  const uploaded = helpRequestImageSchema.parse({
    id: "image-1",
    source: "UPLOAD",
    contentType: "image/webp",
    sizeBytes: 1234,
    updatedAt: "2026-09-23T12:00:00.000Z",
  });
  assert.equal(uploaded.source, "UPLOAD");
  assert.equal("objectKey" in uploaded, false);
  assert.equal("externalUrl" in uploaded, false);

  const external = helpRequestImageSchema.parse({
    id: "image-2",
    source: "EXTERNAL_URL",
    contentType: null,
    sizeBytes: null,
    updatedAt: "2026-09-23T12:00:00.000Z",
  });
  assert.equal(external.source, "EXTERNAL_URL");
  assert.equal("externalUrl" in external, false);

  assert.deepEqual(
    helpRequestImageDeliverySchema.parse({
      contentUrl: "https://cdn.example.test/request.webp",
      expiresAt: null,
    }),
    {
      contentUrl: "https://cdn.example.test/request.webp",
      expiresAt: null,
    },
  );
});

test("Request external image input accepts only credential-free http/https URLs", () => {
  assert.equal(
    helpRequestExternalImageInputSchema.parse({ url: "https://images.example.test/photo.jpg" }).url,
    "https://images.example.test/photo.jpg",
  );
  assert.equal(
    helpRequestExternalImageInputSchema.parse({ url: "http://images.example.test/photo.webp" }).url,
    "http://images.example.test/photo.webp",
  );

  for (const url of [
    "ftp://images.example.test/photo.jpg",
    "file:///tmp/photo.jpg",
    "https://user:secret@images.example.test/photo.jpg",
    "not-a-url",
  ]) {
    assert.equal(helpRequestExternalImageInputSchema.safeParse({ url }).success, false, url);
  }
});
