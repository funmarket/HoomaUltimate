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
const homePage = await readFile(
  new URL("../apps/web/src/home/HomePage.tsx", import.meta.url),
  "utf8",
);

test("homepage gateway artwork remains lazy after retired Home hero removal", () => {
  assert.match(gatewayCard, /loading="lazy"/);
  assert.match(gatewayCard, /decoding="async"/);
  assert.doesNotMatch(gatewayCard, /loading="eager"/);
  assert.doesNotMatch(gatewayCard, /decoding="sync"/);
});

test("HOME_TOP uses PageBanner without retired Match Day fallback markup", () => {
  assert.match(homePage, /placementId="HOME_TOP"/);
  assert.doesNotMatch(homePage, /fallback=\{/);
  assert.doesNotMatch(homePage, /home-hero\/matchday\.webp/);
  assert.doesNotMatch(homePage, /page-banner__fallback-link--home/);
});

test("homepage gateway contract is a phone-first three by two grid", () => {
  assert.match(gatewayGrid, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(gatewayGrid, /repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(gatewayGrid, /@media \(max-width: 430px\)/);
  assert.match(gatewayGrid, /min-width:\s*0/);

  const expectedOrder = [
    'id: "hooma"',
    'id: "teams"',
    'id: "pitch"',
    'id: "spots"',
    'id: "ride"',
    'id: "requests"',
  ];
  let cursor = -1;
  for (const marker of expectedOrder) {
    const next = gateways.indexOf(marker);
    assert.ok(next > cursor, `${marker} must stay in the governed 3x2 order`);
    cursor = next;
  }

  assert.match(gateways, /label: "Pitch"[\s\S]*?href: "\/pitch"/);
  assert.match(gateways, /label: "Places"[\s\S]*?href: "\/places"/);
  assert.match(gateways, /label: "Ride"[\s\S]*?href: "\/rides"/);
  assert.match(gateways, /label: "Requests"[\s\S]*?href: "\/requests"/);
  assert.match(gateways, /artwork: "\/home-gateways\/pitch\.webp"/);
  assert.equal((gateways.match(/\bid:\s*"/g) ?? []).length, 6);
  assert.doesNotMatch(gateways, /id: "gamers"/);
  assert.doesNotMatch(gateways, /id: "ultras"/);
  assert.doesNotMatch(gateways, /id: "fundme"/);
});
