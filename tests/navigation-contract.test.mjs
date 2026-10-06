import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("locked bottom navigation and six-card Home gateway cannot drift", async () => {
  const navSource = await readFile("packages/ui/src/navigation/HoomaBottomNav.tsx", "utf8");
  const gatewaySource = await readFile("packages/ui/src/home/home-gateways.ts", "utf8");
  const accountCss = await readFile("apps/web/src/account/account.css", "utf8");
  const nav = navSource.slice(
    navSource.indexOf("export const PRIMARY_NAV_ITEMS"),
    navSource.indexOf("export interface HoomaBottomNavProps"),
  );
  assert.deepEqual(
    [...nav.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]),
    ["Home", "Play", "Watch", "HOOMA", "Athletes"],
  );
  assert.deepEqual(
    [...gatewaySource.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]),
    ["HOOMA", "Teams", "Pitch", "Places", "Ride", "Requests"],
  );
  assert.deepEqual(
    [...gatewaySource.matchAll(/subtitle: "([^"]+)"/g)].map((match) => match[1]),
    [
      "Community",
      "Manage squads",
      "Find a pitch",
      "Cafés & lounges",
      "To the match",
      "Gear and support",
    ],
  );
  assert.deepEqual(
    [...gatewaySource.matchAll(/href: ("[^"]+"|null)/g)].map((match) => match[1]),
    ['"/hooma"', '"/teams"', '"/pitch"', '"/places"', '"/rides"', '"/requests"'],
  );
  assert.doesNotMatch(gatewaySource, /label: "Gamers"/);
  assert.doesNotMatch(gatewaySource, /label: "Ultras"/);
  assert.doesNotMatch(gatewaySource, /label: "FundMe"/);
  assert.doesNotMatch(accountCss, /margin-inline:\s*calc\(-1 \* var\(--shell-inline\)\)/);
  assert.doesNotMatch(accountCss, /\.hooma-topbar\s*\{[\s\S]*inline-size:\s*100vw/);
});

test("fixed navigation consumes canonical NAV spacing while preserving its mechanics", async () => {
  const css = await readFile("packages/ui/src/navigation/bottom-nav.css", "utf8");
  const nav = css.match(/\.hooma-bottom-nav\s*\{([^{}]*)\}/)?.[1] ?? "";
  assert.match(nav, /position:\s*fixed/);
  for (const side of ["left", "right"]) {
    assert.match(
      nav,
      new RegExp(
        `${side}:\\s*max\\(var\\(--hooma-ui-lane-nav-inline\\), calc\\(\\(100vw - 736px\\) / 2\\)\\)`,
      ),
    );
    assert.doesNotMatch(css, new RegExp(`${side}:\\s*8px`));
  }
  assert.match(nav, /bottom:\s*calc\(env\(safe-area-inset-bottom, 0px\) \+ 6px\)/);
  assert.match(css, /\.hooma-bottom-nav--hidden\s*\{[\s\S]*transform:\s*translateY/);
  assert.match(css, /\.hooma-bottom-nav__item--active\s*\{[\s\S]*color:\s*#aaff00/);
  assert.match(css, /padding-bottom:\s*calc\(88px \+ env\(safe-area-inset-bottom, 0px\)\)/);
});

test("Home gateway cards expose visible labels and disable unavailable destinations", async () => {
  const [grid, card, webHome, telegramPackage, uiIndex] = await Promise.all([
    readFile("packages/ui/src/home/HomeGatewayGrid.tsx", "utf8"),
    readFile("packages/ui/src/home/HomeGatewayCard.tsx", "utf8"),
    readFile("apps/web/src/home/HomePage.tsx", "utf8"),
    readFile("apps/telegram/package.json", "utf8"),
    readFile("packages/ui/src/index.tsx", "utf8"),
  ]);
  assert.match(grid, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
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
