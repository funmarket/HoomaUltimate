import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

for (const [lane, gutter] of [
  ["media", "8px"],
  ["nav", "8px"],
  ["content", "var(--hooma-ui-page-inline)"],
  ["bleed", "0px"],
]) {
  test(`${lane.toUpperCase()} lane has one canonical gutter and an opt-in padding container`, async () => {
    const [theme, styles] = await Promise.all([
      read("apps/web/src/theme.css"),
      read("apps/web/src/styles.css"),
    ]);
    const token = `--hooma-ui-lane-${lane}-inline`;
    const definitions = [
      ...`${theme}\n${styles}`.matchAll(new RegExp(`${token}:\\s*([^;]+);`, "g")),
    ];
    assert.equal(definitions.length, 1, `${lane.toUpperCase()} needs one canonical lane token`);
    assert.equal(definitions[0][1], gutter);
    assert.ok(theme.includes(`${token}:`), "theme owns the lane tokens");

    const containers = [
      ...styles.matchAll(new RegExp(`\\.hooma-lane--${lane}\\s*\\{([^}]+)\\}`, "g")),
    ];
    assert.equal(containers.length, 1, `${lane.toUpperCase()} needs one opt-in lane container`);
    assert.equal(containers[0][1].trim(), `padding-inline: var(${token});`);
    assert.doesNotMatch(containers[0][1], /margin|!important|transform|100vw|calc\(/);
  });
}

test("inactive lanes preserve the legacy shell inset and media-first vertical alignment", async () => {
  const [theme, styles, shell] = await Promise.all([
    read("apps/web/src/theme.css"),
    read("apps/web/src/styles.css"),
    read("apps/web/src/app/shell/HoomaShell.tsx"),
  ]);
  assert.match(theme, /--hooma-ui-page-inline:\s*16px;/);
  assert.match(styles, /--shell-inline:\s*clamp\(12px, 6vw, 24px\);/);
  const shellRule = styles.match(/(?:^|\n\s*\n)\.foundation-shell\s*\{([^}]+)\}/)?.[1];
  assert.ok(shellRule);
  assert.match(shellRule, /padding:\s*0 var\(--shell-inline\) 48px;/);
  assert.match(
    styles,
    /\.foundation-shell--media-first\s*\{\s*align-content:\s*start;\s*row-gap:\s*0;/,
  );
  assert.doesNotMatch(shell, /hooma-lane/);
});

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
