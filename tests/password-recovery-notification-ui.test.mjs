import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("password recovery notification uses HOOMA Telegram runtime rather than Bot API delivery", async () => {
  const [control, api, shell, botApi] = await Promise.all([
    read("apps/web/src/notifications/UserNotificationControl.tsx"),
    read("packages/frontend/src/api.ts"),
    read("apps/web/src/app/shell/HoomaShell.tsx"),
    read("apps/api/src/infrastructure/telegram/bot-api.ts"),
  ]);

  assert.match(control, /PASSWORD_RECOVERY/);
  assert.match(control, /passwordRecoveryCodeFromNotification/);
  assert.match(control, /Recovery code:/);
  assert.match(control, /Open HOOMA in Telegram/);
  assert.match(api, /passwordRecoveryCodeFromNotification/);
  assert.match(shell, /telegramRuntime=\{hasTelegramIdentity\}/);
  assert.doesNotMatch(botApi, /sendTelegramMessage/);
});
