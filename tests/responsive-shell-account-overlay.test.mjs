import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("global shell adapts below 320px from one inline spacing source", async () => {
  const [styles, account] = await Promise.all([
    read("apps/web/src/styles.css"),
    read("apps/web/src/account/account.css"),
  ]);

  assert.doesNotMatch(styles, /min-width:\s*320px/);
  assert.match(styles, /--shell-inline:\s*clamp\(12px, 6vw, 24px\)/);
  assert.match(styles, /\.foundation-shell\s*\{[\s\S]*width:\s*100%/);
  assert.match(
    styles,
    /\.foundation-shell\s*\{[\s\S]*padding:\s*0 var\(--shell-inline\) 48px/,
  );
  assert.match(
    account,
    /margin-inline:\s*calc\(-1 \* var\(--shell-inline\)\)/,
  );
  assert.match(
    account,
    /padding:\s*max\(8px, env\(safe-area-inset-top, 0px\)\) var\(--shell-inline\) 10px/,
  );
  assert.doesNotMatch(account, /margin-inline:\s*-24px/);
});

test("account menu uses the browser top layer and collision-aware viewport geometry", async () => {
  const [header, account] = await Promise.all([
    read("packages/ui/src/account/HoomaAccountHeader.tsx"),
    read("apps/web/src/account/account.css"),
  ]);

  assert.match(header, /popover="auto"/);
  assert.match(header, /\.showPopover\(\)/);
  assert.match(header, /\.hidePopover\(\)/);
  assert.match(header, /window\.visualViewport/);
  assert.match(
    header,
    /\.hooma-bottom-nav:not\(\.hooma-bottom-nav--hidden\)/,
  );
  assert.match(header, /maxHeight:\s*Math\.max\(0, bottomLimit - top\)/);
  assert.match(header, /addEventListener\("resize", updateGeometry\)/);
  assert.match(header, /addEventListener\("scroll", updateGeometry\)/);
  assert.match(
    account,
    /\.hooma-account-menu\s*\{[\s\S]*position:\s*fixed/,
  );
  assert.doesNotMatch(
    account,
    /\.hooma-account-menu\s*\{[\s\S]*top:\s*calc\(100%/,
  );
});
