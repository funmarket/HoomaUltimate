import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("locked bottom navigation and eight-card Home gateway cannot drift", async () => {
  const [navSource, gatewaySource] = await Promise.all([
    readFile("packages/ui/src/navigation/HoomaBottomNav.tsx", "utf8"),
    readFile("packages/ui/src/home/home-gateways.ts", "utf8"),
  ]);
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
    [...gatewaySource.matchAll(/href: "([^"]+)"/g)].map((match) => match[1]),
    ["/hooma", "/teams", "/ultras", "/gamers", "/places", "/requests", "/rides", "/fundme"],
  );
});

test("Home gateway cards use approved artwork and the shared Web/Telegram frontend", async () => {
  const [grid, card, webHome, telegramPackage] = await Promise.all([
    readFile("packages/ui/src/home/HomeGatewayGrid.tsx", "utf8"),
    readFile("packages/ui/src/home/HomeGatewayCard.tsx", "utf8"),
    readFile("apps/web/src/home/HomePage.tsx", "utf8"),
    readFile("apps/telegram/package.json", "utf8").then(JSON.parse),
  ]);
  assert.match(grid, /grid-template-columns: repeat\(4/);
  assert.match(grid, /font-size: clamp\(17px/);
  assert.match(grid, /font-size: 17px/);
  assert.match(card, /href=\{item\.href\}/);
  assert.match(card, /src=\{item\.artwork\}/);
  assert.match(webHome, /HomeGateway/);
  assert.match(telegramPackage.scripts.build, /@hooma\/web/);
  assert.match(telegramPackage.scripts.start, /\.\.\/web\/dist/);
});
