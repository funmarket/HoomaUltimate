import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Web routing is owned by the shared HoomaRouter instead of pathname switches", async () => {
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
  assert.match(router, /path="\/teams\/:teamId\/lineup"/);
  assert.match(router, /path="\/teams\/:teamId"/);
});

test("Telegram facade serves the shared HOOMA frontend while the shared runtime owns Telegram lifecycle", async () => {
  const [telegramPackage, router, runtime, backButton, shell] = await Promise.all([
    readFile("apps/telegram/package.json", "utf8").then(JSON.parse),
    readFile("apps/web/src/app/router/HoomaRouter.tsx", "utf8"),
    readFile("apps/web/src/telegram/runtime.ts", "utf8"),
    readFile("apps/web/src/telegram/useTelegramBackButton.ts", "utf8"),
    readFile("apps/web/src/app/shell/HoomaShell.tsx", "utf8"),
  ]);

  assert.equal(telegramPackage.scripts.dev, "npm -w @hooma/web run dev");
  assert.equal(
    telegramPackage.scripts.build,
    "npm -w @hooma/frontend run build && npm -w @hooma/web run build",
  );
  assert.equal(telegramPackage.scripts.typecheck, "npm -w @hooma/web run typecheck");
  assert.match(telegramPackage.scripts.start, /serve-static\.mjs \.\.\/web\/dist/);

  assert.match(router, /createTelegramRuntime\(\)/);
  assert.match(runtime, /webApp\.ready\(\)/);
  assert.match(runtime, /webApp\.expand\(\)/);
  assert.match(runtime, /backButton: webApp\?\.BackButton \?\? null/);
  assert.match(backButton, /button\.show\(\)/);
  assert.match(backButton, /button\.hide\(\)/);
  assert.match(backButton, /button\.onClick\(goBack\)/);
  assert.match(backButton, /button\.offClick\(goBack\)/);
  assert.match(shell, /useEffect\(\(\) => runtime\.connect\(\), \[runtime\]\)/);
  assert.match(shell, /useTelegramBackButton\(runtime\)/);
});

test("Web and Telegram pin the same React Router version", async () => {
  const [webPackage, telegramPackage] = await Promise.all([
    readFile("apps/web/package.json", "utf8").then(JSON.parse),
    readFile("apps/telegram/package.json", "utf8").then(JSON.parse),
  ]);
  assert.equal(webPackage.dependencies["react-router-dom"], "7.18.2");
  assert.equal(telegramPackage.dependencies["react-router-dom"], "7.18.2");
});
