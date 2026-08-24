import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("locked bottom navigation and eight-card Home gateway cannot drift", async () => {
  const indexSource = await readFile("packages/ui/src/index.tsx", "utf8");
  const gatewaySource = await readFile("packages/ui/src/home/home-gateways.ts", "utf8");
  const nav = indexSource.slice(
    indexSource.indexOf("export const PRIMARY_NAV_ITEMS"),
    indexSource.indexOf("export interface FoundationShellProps"),
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

test("Home gateway cards use shared approved artwork and readable typography on Web and Telegram", async () => {
  const [grid, card, webVite, telegramVite, webHome, telegramHome] = await Promise.all([
    readFile("packages/ui/src/home/HomeGatewayGrid.tsx", "utf8"),
    readFile("packages/ui/src/home/HomeGatewayCard.tsx", "utf8"),
    readFile("apps/web/vite.config.ts", "utf8"),
    readFile("apps/telegram/vite.config.ts", "utf8"),
    readFile("apps/web/src/home/HomePage.tsx", "utf8"),
    readFile("apps/telegram/src/home/HomePage.tsx", "utf8"),
  ]);
  assert.match(grid, /grid-template-columns: repeat\(4/);
  assert.match(grid, /font-size: clamp\(17px/);
  assert.match(grid, /font-size: 17px/);
  assert.match(card, /href=\{item\.href\}/);
  assert.match(card, /src=\{item\.artwork\}/);
  assert.match(webVite, /publicDir: "\.\.\/\.\.\/packages\/ui\/public"/);
  assert.match(telegramVite, /publicDir: "\.\.\/\.\.\/packages\/ui\/public"/);
  assert.match(webHome, /HomeGateway/);
  assert.match(telegramHome, /HomeGateway/);
});
