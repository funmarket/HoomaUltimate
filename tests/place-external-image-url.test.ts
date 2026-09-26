import assert from "node:assert/strict";
import test from "node:test";
import { placeImageUrlSchema } from "../packages/contracts/src/places.js";
import {
  normalizeExternalPlaceImageUrl,
} from "../apps/api/src/modules/places/boundary/external-place-image-url.js";

test("keeps ordinary direct image URLs unchanged", () => {
  const image = "https://example.com/photos/cafe-thirteen.jpg?size=large&token=a%2Fb";
  assert.equal(normalizeExternalPlaceImageUrl(image), image);
});

test("unwraps Google imgres image targets", () => {
  const image = "https://cdn.example.com/cafe-thirteen.webp?width=1200";
  const google = `https://www.google.com/imgres?imgurl=${encodeURIComponent(
    image,
  )}&imgrefurl=https%3A%2F%2Fexample.com`;
  assert.equal(normalizeExternalPlaceImageUrl(google), image);
});

test("unwraps Google image targets on search result URLs", () => {
  const image = "https://images.example.org/cafe-13.png";
  const google = `https://www.google.tn/search?udm=2&q=cafe+13&imgurl=${encodeURIComponent(image)}`;
  assert.equal(normalizeExternalPlaceImageUrl(google), image);
});

test("unwraps nested Google redirect links without altering the final image URL", () => {
  const image = "https://images.example.org/cafe-13.jpg?sig=abc%2F123";
  const inner = `https://www.google.com/imgres?imgurl=${encodeURIComponent(image)}`;
  const outer = `https://www.google.com/url?url=${encodeURIComponent(inner)}`;
  assert.equal(normalizeExternalPlaceImageUrl(outer), image);
});

test("Place image input accepts ordinary CDN and signed HTTP/HTTPS URLs", () => {
  for (const value of [
    "https://cdn.example.com/pitch.webp?width=1600&sig=a%2Fb",
    "http://images.example.org/pitch.jpg?token=abc123",
  ]) {
    assert.equal(placeImageUrlSchema.parse(value), value);
  }
});

test("Place image input rejects unsafe and local URL schemes", () => {
  for (const value of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:image/png;base64,AAAA",
  ]) {
    assert.equal(placeImageUrlSchema.safeParse(value).success, false);
  }
});
