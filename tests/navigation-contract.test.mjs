import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
test("locked bottom navigation and eight-card Home gateway cannot drift", async () => {
  const source = await readFile("packages/ui/src/index.tsx", "utf8");
  const nav = source.slice(source.indexOf("export const PRIMARY_NAV_ITEMS"), source.indexOf("export const HOME_GATEWAYS"));
  const gateway = source.slice(source.indexOf("export const HOME_GATEWAYS"), source.indexOf("export interface FoundationShellProps"));
  assert.deepEqual([...nav.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]), ["Home", "Play", "Watch", "HOOMA", "Pitch"]);
  assert.deepEqual([...gateway.matchAll(/label: "([^"]+)"/g)].map((match) => match[1]), ["HOOMA", "Teams", "Ultras", "Gamers", "Places", "Requests", "Ride", "FundMe"]);
});
