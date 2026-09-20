import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Web auth exposes Telegram-backed password recovery without a plaintext temporary password", async () => {
  const [authApp, frontendApi] = await Promise.all([
    read("apps/web/src/auth/AuthApp.tsx"),
    read("packages/frontend/src/api.ts"),
  ]);

  assert.match(authApp, /Forgot password\?/);
  assert.match(authApp, /Send recovery code/);
  assert.match(authApp, /linked Telegram account/);
  assert.match(authApp, /autoComplete="one-time-code"/);
  assert.match(authApp, /Reset password/);
  assert.doesNotMatch(authApp, /temporary password/i);
  assert.match(frontendApi, /requestPasswordRecovery/);
  assert.match(frontendApi, /confirmPasswordRecovery/);
});
