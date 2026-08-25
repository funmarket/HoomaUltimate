import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const shell = await readFile(
  new URL("../apps/web/src/app/shell/HoomaShell.tsx", import.meta.url),
  "utf8",
);
const header = await readFile(
  new URL("../packages/ui/src/account/HoomaAccountHeader.tsx", import.meta.url),
  "utf8",
);
const accountCss = await readFile(
  new URL("../apps/web/src/account/account.css", import.meta.url),
  "utf8",
);

test("account loading stays a distinct shell/header state rather than guest presentation", () => {
  assert.match(shell, /const \{ me, managedTeams, loading, error, refresh \} = useAccount\(\);/);
  assert.match(shell, /<HoomaAccountHeader[\s\S]*loading=\{loading\}/);

  assert.match(header, /readonly loading: boolean;/);
  assert.match(header, /const accountLabel = loading/);
  assert.match(header, /\? "Loading account"/);
  assert.match(header, /aria-label=\{accountLabel\}/);
  assert.match(header, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(header, /disabled=\{loading\}/);
  assert.match(header, /hooma-profile-trigger__loading/);
  assert.match(header, /if \(loading\) setOpen\(false\);/);

  assert.match(accountCss, /\.hooma-profile-trigger__loading \{/);
  assert.match(accountCss, /@media \(prefers-reduced-motion: reduce\)/);
});
