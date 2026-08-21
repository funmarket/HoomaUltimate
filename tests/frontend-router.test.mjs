import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Web routing is owned by a real router instead of main.tsx pathname switches", async () => {
  const [main, router] = await Promise.all([
    readFile("apps/web/src/main.tsx", "utf8"),
    readFile("apps/web/src/app/router/WebRouter.tsx", "utf8")
  ]);
  assert.doesNotMatch(main, /window\.location\.pathname/);
  assert.doesNotMatch(main, /path\.match/);
  assert.match(main, /<WebRouter \/>/);
  assert.match(router, /BrowserRouter/);
  assert.match(router, /lazy\(/);
  assert.match(router, /path="\/events\/:eventId\/chat"/);
  assert.match(router, /path="\/teams\/:teamId"/);
});

test("Telegram routing owns BackButton lifecycle and does not hand-switch pathname", async () => {
  const [main, router, backButton, shell] = await Promise.all([
    readFile("apps/telegram/src/main.tsx", "utf8"),
    readFile("apps/telegram/src/app/router/TelegramRouter.tsx", "utf8"),
    readFile("apps/telegram/src/telegram/useTelegramBackButton.ts", "utf8"),
    readFile("apps/telegram/src/app/shell/TelegramShell.tsx", "utf8")
  ]);
  assert.doesNotMatch(main, /window\.location\.pathname/);
  assert.match(main, /<TelegramApp \/>/);
  assert.match(router, /BrowserRouter/);
  assert.match(router, /lazy\(/);
  assert.match(backButton, /button\.show\(\)/);
  assert.match(backButton, /button\.hide\(\)/);
  assert.match(backButton, /button\.onClick\(goBack\)/);
  assert.match(backButton, /button\.offClick\(goBack\)/);
  assert.match(shell, /NavLink/);
});

test("Web and Telegram pin the same React Router version", async () => {
  const [webPackage, telegramPackage] = await Promise.all([
    readFile("apps/web/package.json", "utf8").then(JSON.parse),
    readFile("apps/telegram/package.json", "utf8").then(JSON.parse)
  ]);
  assert.equal(webPackage.dependencies["react-router-dom"], "7.18.2");
  assert.equal(telegramPackage.dependencies["react-router-dom"], "7.18.2");
});
