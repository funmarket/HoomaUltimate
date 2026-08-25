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

test("account loading is a distinct shell/header state rather than guest presentation", () => {
  assert.match(shell, /const \{ me, managedTeams, loading, error, refresh \} = useAccount\(\);/);
  assert.match(shell, /<HoomaAccountHeader[\s\S]*loading=\{loading\}/);

  assert.match(header, /readonly loading: boolean;/);
  assert.match(header, /if \(loading\) \{/);
  assert.match(header, /<header className="hooma-account-header" aria-busy="true">/);
  assert.match(header, /hooma-account-header__avatar--loading/);
  assert.match(header, /if \(loading\) setOpen\(false\);/);
  assert.match(header, /\{user\?\.displayName \?\? "Profile"\}/);
  assert.match(header, /Sign in or create account/);

  assert.match(accountCss, /\.hooma-account-header__avatar--loading \{/);
  assert.match(accountCss, /@media \(prefers-reduced-motion: reduce\)/);
});
