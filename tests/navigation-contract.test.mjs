import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("locked bottom navigation and eight-card Home gateway cannot drift", async () => {
  const navSource = await readFile("packages/ui/src/navigation/HoomaBottomNav.tsx", "utf8");
  const gatewaySource = await readFile("packages/ui/src/home/home-gateways.ts", "utf8");
  const nav = navSource.slice(
    navSource.indexOf("export const PRIMARY_NAV_ITEMS"),
    navSource.indexOf("export interface HoomaBottomNavProps"),
  );
  assert.deepEqual(
    [...nav.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]),
    ["Home", "Play", "Watch", "HOOMA", "Pitch"],
  );
  assert.deepEqual(
    [...gatewaySource.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]),
    ["HOOMA", "Teams", "Ultras", "Gamers", "Places", "Requests", "Ride", "FundMe"],
  );
  assert.deepEqual(
    [...gatewaySource.matchAll(/subtitle: "([^"]+)"/g)].map((match) => match[1]),
    [
      "Community",
      "Manage squads",
      "Coming soon",
      "Find opponents",
      "Watch + Pitch",
      "Coming soon",
      "Coming soon",
      "Coming soon",
    ],
  );
  assert.deepEqual(
    [...gatewaySource.matchAll(/href: ("[^"]+"|null)/g)].map((match) => match[1]),
    ['"/hooma"', '"/teams"', "null", '"/gamers"', '"/places"', "null", "null", "null"],
  );
});

test("Home gateway cards expose visible labels and disable unavailable destinations", async () => {
  const [grid, card, webHome, telegramPackage, uiIndex] = await Promise.all([
    readFile("packages/ui/src/home/HomeGatewayGrid.tsx", "utf8"),
    readFile("packages/ui/src/home/HomeGatewayCard.tsx", "utf8"),
    readFile("apps/web/src/home/HomePage.tsx", "utf8"),
    readFile("apps/telegram/package.json", "utf8"),
    readFile("packages/ui/src/index.tsx", "utf8"),
  ]);
  assert.match(grid, /grid-template-columns: repeat\(4/);
  assert.match(grid, />Quick actions<\/p>/);
  assert.match(grid, /home-gateway-card__title/);
  assert.match(grid, /home-gateway-card__subtitle/);
  assert.match(grid, /object-fit: contain/);
  assert.match(uiIndex, /home-gateway-title/);
  assert.match(card, /home-gateway-card__title/);
  assert.match(card, /home-gateway-card__subtitle/);
  assert.match(card, /item\.availability === "coming-soon"/);
  assert.match(card, /disabled/);
  assert.match(card, /href=\{item\.href\}/);
  assert.match(card, /src=\{item\.artwork\}/);
  assert.match(webHome, /HomeGateway/);
  assert.match(telegramPackage, /@hooma\/web/);
  assert.match(telegramPackage, /serve-static\.mjs/);
});
