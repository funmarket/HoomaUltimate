import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Telegram runtime reacts to viewport, safe-area, content-safe-area and theme changes", async () => {
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
  assert.match(runtime, /webApp\.ready\(\)/);
  assert.match(runtime, /webApp\.expand\(\)/);

  assert.match(shell, /useEffect\(\(\) => runtime\.connect\(\), \[runtime\]\)/);
  assert.match(router, /createTelegramRuntime\(\)/);
  assert.match(main, /\.\/telegram\/runtime\.css/);
  assert.match(theme, /telegramColorScheme\(\)/);

  assert.match(runtimeCss, /min-height: var\(--hooma-viewport-height\)/);
  assert.match(runtimeCss, /data-telegram-runtime="active"/);
  assert.match(runtimeCss, /--hooma-safe-area-inset-bottom/);
  assert.match(runtimeCss, /--hooma-content-safe-area-inset-bottom/);
});
