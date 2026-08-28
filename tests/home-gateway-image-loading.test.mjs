import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const gatewayCard = await readFile(
  new URL("../packages/ui/src/home/HomeGatewayCard.tsx", import.meta.url),
  "utf8",
);
const gatewayGrid = await readFile(
  new URL("../packages/ui/src/home/HomeGatewayGrid.tsx", import.meta.url),
  "utf8",
);
const gateways = await readFile(
  new URL("../packages/ui/src/home/home-gateways.ts", import.meta.url),
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

test("homepage gateway contract is a phone-first three by three grid", () => {
  assert.match(gatewayGrid, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(gatewayGrid, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(gatewayGrid, /@media \(max-width: 430px\)/);
  assert.match(gatewayGrid, /min-width:\s*0/);

  const expectedOrder = [
    'id: "hooma"',
    'id: "teams"',
    'id: "ultras"',
    'id: "spots"',
    'id: "pitch"',
    'id: "gamers"',
    'id: "ride"',
    'id: "requests"',
    'id: "fundme"',
  ];
  let cursor = -1;
  for (const marker of expectedOrder) {
    const next = gateways.indexOf(marker);
    assert.ok(next > cursor, `${marker} must stay in the governed 3x3 order`);
    cursor = next;
  }

  assert.match(gateways, /label: "Spots"[\s\S]*?href: "\/places"/);
  assert.match(gateways, /label: "Pitch"[\s\S]*?href: "\/pitch"/);
  assert.match(gateways, /artwork: "\/home-gateways\/pitch\.webp"/);
  assert.equal((gateways.match(/\bid:\s*"/g) ?? []).length, 9);
});
