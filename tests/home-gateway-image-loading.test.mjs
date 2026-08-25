import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const gatewayCard = await readFile(
  new URL("../packages/ui/src/home/HomeGatewayCard.tsx", import.meta.url),
  "utf8",
);
const homeHero = await readFile(
  new URL("../packages/ui/src/home/HomeHero.tsx", import.meta.url),
  "utf8",
);

test("homepage gateway artwork does not compete with the critical hero image", () => {
  assert.match(gatewayCard, /loading="lazy"/);
  assert.match(gatewayCard, /decoding="async"/);
  assert.doesNotMatch(gatewayCard, /loading="eager"/);
  assert.doesNotMatch(gatewayCard, /decoding="sync"/);

  assert.match(homeHero, /loading="eager"/);
  assert.match(homeHero, /fetchPriority="high"/);
});
