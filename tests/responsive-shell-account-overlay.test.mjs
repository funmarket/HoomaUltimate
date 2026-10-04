import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("global shell adapts below 320px from one inline spacing source", async () => {
  const [styles, account] = await Promise.all([
    read("apps/web/src/styles.css"),
    read("apps/web/src/account/account.css"),
  ]);

  assert.doesNotMatch(styles, /min-width:\s*320px/);
  assert.match(styles, /--shell-inline:\s*clamp\(12px, 6vw, 24px\)/);
  assert.match(styles, /\.foundation-shell\s*\{[\s\S]*width:\s*100%/);
  assert.match(styles, /\.foundation-shell\s*\{[\s\S]*padding:\s*0 var\(--shell-inline\) 48px/);
  assert.match(account, /margin-inline:\s*calc\(-1 \* var\(--shell-inline\)\)/);
  assert.match(
    account,
    /padding:\s*max\(8px, env\(safe-area-inset-top, 0px\)\) var\(--shell-inline\) 10px/,
  );
  assert.doesNotMatch(account, /margin-inline:\s*-24px/);
});

test("account menu uses the browser top layer and collision-aware viewport geometry", async () => {
  const [header, account, overlay] = await Promise.all([
    read("packages/ui/src/account/HoomaAccountHeader.tsx"),
    read("apps/web/src/account/account.css"),
    read("packages/ui/src/overlay/anchored-popover.ts"),
  ]);

  assert.match(header, /popover="auto"/);
  assert.match(header, /useAnchoredPopover\(/);
  assert.doesNotMatch(header, /accountMenuGeometry/);

  assert.match(overlay, /\.showPopover\(\)/);
  assert.match(overlay, /\.hidePopover\(\)/);
  assert.match(overlay, /window\.visualViewport/);
  assert.match(overlay, /\.hooma-bottom-nav:not\(\.hooma-bottom-nav--hidden\)/);
  assert.match(overlay, /maxHeight:\s*Math\.max\(0, bottomLimit - top\)/);
  assert.match(overlay, /addEventListener\("resize", updateGeometry\)/);
  assert.match(overlay, /addEventListener\("scroll", updateGeometry\)/);
  assert.match(account, /\.hooma-account-menu\s*\{[\s\S]*position:\s*fixed/);
  assert.doesNotMatch(account, /\.hooma-account-menu\s*\{[\s\S]*top:\s*calc\(100%/);
});

test("the notification panel shares the one anchored-overlay geometry implementation", async () => {
  const [bell, account] = await Promise.all([
    read("apps/web/src/notifications/UserNotificationControl.tsx"),
    read("apps/web/src/account/account.css"),
  ]);

  assert.match(bell, /useAnchoredPopover\(/);
  assert.match(bell, /popover="auto"/);
  assert.doesNotMatch(bell, /notificationMenuGeometry|getBoundingClientRect/);
  assert.match(bell, /page\.unreadCount/);

  assert.match(account, /\.hooma-notification-popover\s*\{[\s\S]*position:\s*fixed/);
  assert.doesNotMatch(account, /\.hooma-notification-popover\s*\{[\s\S]*z-index/);
  assert.doesNotMatch(account, /\.hooma-notification-popover\s*\{[\s\S]*right:\s*0;/);
  assert.doesNotMatch(account, /\.hooma-notification-popover\s*\{[\s\S]*inset-block-start/);
});
