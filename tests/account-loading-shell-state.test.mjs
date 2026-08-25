import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const shell = await readFile(
  new URL("../apps/web/src/app/shell/HoomaShell.tsx", import.meta.url),
  "utf8",
);
const auth = await readFile(new URL("../apps/web/src/auth/AuthApp.tsx", import.meta.url), "utf8");
const accountProvider = await readFile(
  new URL("../apps/web/src/account/AccountProvider.tsx", import.meta.url),
  "utf8",
);
const router = await readFile(
  new URL("../apps/web/src/app/router/HoomaRouter.tsx", import.meta.url),
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
  assert.match(
    shell,
    /const \{ me, managedTeams, hasPlatformControlAccess, loading, error, refresh \} = useAccount\(\);/,
  );
  assert.match(shell, /<HoomaAccountHeader[\s\S]*loading=\{loading\}/);

  assert.match(header, /readonly loading: boolean;/);
  assert.match(header, /loading\s*\?\s*"Loading account"/);
  assert.match(header, /aria-busy=\{loading \|\| undefined\}/);
  assert.match(header, /disabled=\{loading\}/);
  assert.match(header, /hooma-profile-trigger__loading/);
  assert.match(header, /if \(loading\) setOpen\(false\);/);
  assert.match(header, /\{user \? \(/);
  assert.match(header, /if \(!open\) \{/);
  assert.match(header, /menu\.showPopover\(\)/);

  assert.match(accountCss, /\.hooma-profile-trigger__loading \{/);
  assert.match(accountCss, /@media \(prefers-reduced-motion: reduce\)/);
});

test("classic auth screen consumes AccountProvider as the single account source of truth", () => {
  assert.match(auth, /import \{ useAccount \} from "\.\.\/account\/AccountProvider";/);
  assert.match(auth, /const \{ me, loading, error: accountError, refresh \} = useAccount\(\);/);
  assert.doesNotMatch(auth, /useState<MeResponse \| null>/);
  assert.doesNotMatch(auth, /api\.identity\.meOptional\(\)/);
  assert.doesNotMatch(auth, /api\.identity\.me\(\)/);
  assert.match(auth, /await api\.identity\.logout\(\);\s+await refresh\(\);/);
  assert.match(
    auth,
    /async function completeAuthentication\(\)[\s\S]*if \(await refresh\(\)\) \{\s*window\.location\.replace\(returnTo\);/,
  );
  assert.match(auth, /const visibleError = error \|\| accountError;/);
  assert.match(auth, /if \(loading\)[\s\S]*aria-busy="true"/);
  assert.match(accountProvider, /readonly refresh: \(\) => Promise<boolean>;/);
  assert.match(accountProvider, /async function refresh\(\): Promise<boolean>/);
  assert.match(accountProvider, /catch \(reason\)[\s\S]*return false;/);
  assert.match(accountProvider, /hasPlatformControlAccess/);
});

test("Telegram delivery never exposes the classic Web login or registration forms", () => {
  assert.match(
    router,
    /runtime\.initData[\s\S]*\? `\/account\/create\?returnTo=\$\{encodeURIComponent\(returnTo\)\}`[\s\S]*: `\/register\?returnTo=\$\{encodeURIComponent\(returnTo\)\}`/,
  );
  assert.match(
    router,
    /const accountEntry = runtime\.initData \? <TelegramAccountActivationPage \/> : <AuthApp \/>;/,
  );
  assert.match(router, /<Route path="\/login" element=\{accountEntry\} \/>/);
  assert.match(router, /<Route path="\/register" element=\{accountEntry\} \/>/);
  assert.match(
    router,
    /getHeaders: \(\) => \(runtime\.initData \? \{ authorization: `tma \$\{runtime\.initData\}` \} : \{\}\)/,
  );
});
