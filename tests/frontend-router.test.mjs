import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Web routing is owned by the shared HoomaRouter instead of main.tsx pathname switches", async () => {
  const [main, router] = await Promise.all([
    readFile("apps/web/src/main.tsx", "utf8"),
    readFile("apps/web/src/app/router/HoomaRouter.tsx", "utf8"),
  ]);
  assert.doesNotMatch(main, /window\.location\.pathname/);
  assert.doesNotMatch(main, /path\.match/);
  assert.match(main, /<HoomaRouter \/>/);
  assert.match(router, /BrowserRouter/);
  assert.match(router, /lazy\(/);
  assert.match(router, /path="\/events\/:eventId\/chat"/);
  assert.match(router, /path="\/teams\/:teamId"/);
});

test("shared Web/Telegram router initializes Telegram lifecycle and authentication transport", async () => {
  const [router, runtime, telegramPackage] = await Promise.all([
    readFile("apps/web/src/app/router/HoomaRouter.tsx", "utf8"),
    readFile("apps/web/src/telegram/runtime.ts", "utf8"),
    readFile("apps/telegram/package.json", "utf8").then(JSON.parse),
  ]);
  assert.match(router, /initializeTelegramRuntime/);
  assert.match(router, /authorization: `tma \$\{runtime\.initData\}`/);
  assert.match(runtime, /webApp\.ready\(\)/);
  assert.match(runtime, /webApp\.expand\(\)/);
  assert.match(runtime, /BackButton/);
  assert.match(telegramPackage.scripts.build, /@hooma\/web/);
});

test("Web and Telegram pin the same React Router version", async () => {
  const [webPackage, telegramPackage] = await Promise.all([
    readFile("apps/web/package.json", "utf8").then(JSON.parse),
    readFile("apps/telegram/package.json", "utf8").then(JSON.parse),
  ]);
  assert.equal(webPackage.dependencies["react-router-dom"], "7.18.2");
  assert.equal(telegramPackage.dependencies["react-router-dom"], "7.18.2");
});
