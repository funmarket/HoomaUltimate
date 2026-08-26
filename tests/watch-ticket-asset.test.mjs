import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const EXPECTED_BASE64_LENGTH = 61_340;
const EXPECTED_BYTE_LENGTH = 46_004;
const EXPECTED_SHA256 = "e36640289c338f0dcf20a02837eefd73a51b91d8d21fd8c9d5bcf6000c8fc36f";
const PHOTO_SAFE_RIGHT_EDGE_PERCENT = 30;

async function readGeneratedPart(index) {
  const suffix = String(index).padStart(2, "0");
  const source = await readFile(
    new URL(`../packages/ui/src/brand/generated/watch-ticket-part-${suffix}.ts`, import.meta.url),
    "utf8",
  );
  const match = source.match(/=\s*"([A-Za-z0-9+/=]+)";/);
  assert.ok(match, `Watch ticket asset chunk ${suffix} must contain one encoded string`);
  return match[1];
}

function percentValue(rule, property) {
  const match = rule.match(new RegExp(`${property}:\\s*([0-9.]+)%`));
  assert.ok(match, `Expected ${property} percentage in Watch ticket rule`);
  return Number(match[1]);
}

test("Watch collector ticket master is complete and uncorrupted", async () => {
  const encoded = (
    await Promise.all(Array.from({ length: 7 }, (_, index) => readGeneratedPart(index)))
  ).join("");
  assert.equal(encoded.length, EXPECTED_BASE64_LENGTH);

  const bytes = Buffer.from(encoded, "base64");
  assert.equal(bytes.length, EXPECTED_BYTE_LENGTH);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), EXPECTED_SHA256);
  assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
});

test("Watch Place photo stays inside the corrected master safe area", async () => {
  const css = await readFile(
    new URL("../packages/frontend/src/watch/watch.css", import.meta.url),
    "utf8",
  );
  const rule = css.match(/\.watch-ticket__place-photo \{([\s\S]*?)\n\}/)?.[1] ?? "";
  const left = percentValue(rule, "left");
  const width = percentValue(rule, "width");

  assert.ok(left + width <= PHOTO_SAFE_RIGHT_EDGE_PERCENT);
});
