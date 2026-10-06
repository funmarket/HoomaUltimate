import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Telegram runtime reacts to viewport and safe-area changes without overriding System black", async () => {
  const [runtime, shell, router, runtimeCss, main, theme] = await Promise.all([
    read("apps/web/src/telegram/runtime.ts"),
    read("apps/web/src/app/shell/HoomaShell.tsx"),
    read("apps/web/src/app/router/HoomaRouter.tsx"),
    read("apps/web/src/telegram/runtime.css"),
    read("apps/web/src/main.tsx"),
    read("apps/web/src/settings/theme.ts"),
  ]);

  for (const eventName of [
    "viewportChanged",
    "safeAreaChanged",
    "contentSafeAreaChanged",
    "themeChanged",
  ]) {
    assert.match(runtime, new RegExp(`\\["${eventName}"`));
  }

  assert.match(runtime, /webApp\.onEvent\(eventType, handler\)/);
  assert.match(runtime, /webApp\.offEvent\(eventType, handler\)/);
  assert.match(runtime, /--hooma-viewport-height/);
  assert.match(runtime, /--hooma-viewport-stable-height/);
  assert.match(runtime, /--hooma-safe-area-inset/);
  assert.match(runtime, /--hooma-content-safe-area-inset/);
  assert.match(runtime, /dataset\.telegramColorScheme/);
  assert.doesNotMatch(runtime, /root\.dataset\.theme = scheme/);
  assert.doesNotMatch(runtime, /root\.style\.colorScheme = scheme/);
  assert.match(runtime, /webApp\.ready\(\)/);
  assert.match(runtime, /webApp\.expand\(\)/);

  assert.match(shell, /useEffect\(\(\) => runtime\.connect\(\), \[runtime\]\)/);
  assert.match(router, /createTelegramRuntime\(\)/);
  assert.match(main, /\.\/telegram\/runtime\.css/);
  assert.doesNotMatch(theme, /telegramColorScheme\(\)/);
  assert.match(theme, /mode === "system" \? "dark" : mode/);

  assert.match(runtimeCss, /min-height: var\(--hooma-viewport-height\)/);
  assert.match(runtimeCss, /data-telegram-runtime="active"/);
  assert.match(runtimeCss, /--hooma-safe-area-inset-bottom/);
  assert.match(runtimeCss, /--hooma-content-safe-area-inset-bottom/);
});

test("Telegram protects viewport and safe areas without owning a horizontal page gutter", async () => {
  const css = await read("apps/web/src/telegram/runtime.css");
  const shellRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((match) =>
    match[1].trim().endsWith(".foundation-shell"),
  );
  assert.ok(shellRules.length > 0);
  for (const [, , rule] of shellRules) {
    assert.doesNotMatch(rule, /padding-(?:left|right|inline)\s*:/);
  }
  assert.doesNotMatch(css, /--shell-inline/);
  assert.match(
    css,
    /padding-top:\s*max\([\s\S]*--hooma-safe-area-inset-top[\s\S]*--hooma-content-safe-area-inset-top/,
  );
  assert.match(
    css,
    /\.foundation-shell \.shell-content\s*\{[\s\S]*padding-bottom:\s*max\([\s\S]*88px/,
  );
  const navRules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((match) =>
    match[1].trim().endsWith(".hooma-bottom-nav"),
  );
  assert.equal(navRules.length, 2);
  for (const [, , rule] of navRules) {
    assert.match(rule, /--hooma-ui-lane-nav-inline/);
    assert.doesNotMatch(rule, /\b8px\b/);
    for (const side of ["left", "right", "bottom"]) {
      assert.match(rule, new RegExp(`--hooma-safe-area-inset-${side}`));
      assert.match(rule, new RegExp(`--hooma-content-safe-area-inset-${side}`));
    }
  }
});

test("Telegram lifecycle retains viewport and both safe-area facts through updates and cleanup", async () => {
  const { createTelegramRuntime } = await import("../apps/web/src/telegram/runtime.ts");
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const properties = new Map();
  const handlers = new Map();
  const root = {
    dataset: {},
    style: {
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: (name) => properties.delete(name),
    },
  };
  let ready = 0;
  let expanded = 0;
  // Synthetic host facts exercise runtime transport without inventing a Telegram identity.
  const host = {
    initData: "",
    viewportHeight: 740,
    viewportStableHeight: 720,
    safeAreaInset: { top: 24, bottom: 20, left: 28, right: 12 },
    contentSafeAreaInset: { top: 32, bottom: 16, left: 36, right: 18 },
    ready: () => ready++,
    expand: () => expanded++,
    onEvent: (name, handler) => handlers.set(name, handler),
    offEvent: (name) => handlers.delete(name),
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { innerHeight: 800, Telegram: { WebApp: host } },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: { documentElement: root },
  });
  let disconnect;
  try {
    disconnect = createTelegramRuntime().connect();
    assert.equal(ready, 1);
    assert.equal(expanded, 1);
    assert.equal(root.dataset.telegramRuntime, "active");
    assert.equal(properties.get("--hooma-viewport-height"), "740px");
    assert.equal(properties.get("--hooma-viewport-stable-height"), "720px");
    for (const side of ["top", "bottom", "left", "right"]) {
      assert.equal(
        properties.get(`--hooma-safe-area-inset-${side}`),
        `${host.safeAreaInset[side]}px`,
      );
      assert.equal(
        properties.get(`--hooma-content-safe-area-inset-${side}`),
        `${host.contentSafeAreaInset[side]}px`,
      );
    }
    host.viewportHeight = 680;
    handlers.get("viewportChanged")();
    assert.equal(properties.get("--hooma-viewport-height"), "680px");
    host.safeAreaInset.left = 40;
    handlers.get("safeAreaChanged")();
    assert.equal(properties.get("--hooma-safe-area-inset-left"), "40px");
    host.contentSafeAreaInset.right = 30;
    handlers.get("contentSafeAreaChanged")();
    assert.equal(properties.get("--hooma-content-safe-area-inset-right"), "30px");
    disconnect();
    assert.equal(properties.size, 0);
    assert.equal(handlers.size, 0);
    assert.equal(root.dataset.telegramRuntime, undefined);
  } finally {
    disconnect?.();
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else delete globalThis.window;
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else delete globalThis.document;
  }
});
