import assert from "node:assert/strict";
import test from "node:test";
import { loadApiConfig } from "@hooma/config";

function productionEnvironment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://user:pass@example.test:5432/hooma",
    REDIS_URL: "redis://redis.example.test:6379",
    WEB_ORIGIN: "https://hooma.example.test",
    TELEGRAM_ORIGIN: "https://hooma.example.test",
    TELEGRAM_BOT_TOKEN: "test-bot-token",
    OBJECT_STORAGE_ENDPOINT: "https://storage.example.test",
    OBJECT_STORAGE_REGION: "auto",
    OBJECT_STORAGE_BUCKET: "hooma-test",
    OBJECT_STORAGE_ACCESS_KEY_ID: "access-key",
    OBJECT_STORAGE_SECRET_ACCESS_KEY: "secret-key",
    MEDIA_STORAGE_SCOPE: "production",
    ...overrides,
  };
}

test("production API config requires an explicit HTTPS canonical Web origin", () => {
  const environment = productionEnvironment();
  delete environment.WEB_ORIGIN;

  assert.throws(
    () => loadApiConfig(environment),
    /WEB_ORIGIN must be an explicit HTTPS origin in production/,
  );
});

test("production Telegram origin must be the canonical Web origin", () => {
  assert.throws(
    () =>
      loadApiConfig(
        productionEnvironment({
          TELEGRAM_ORIGIN: "https://telegram.example.test",
        }),
      ),
    /TELEGRAM_ORIGIN must match WEB_ORIGIN/,
  );
});

test("Telegram menu configuration is opt-in and requires a bot token", () => {
  const defaultConfig = loadApiConfig({ DATABASE_URL: "postgresql://local" });
  assert.equal(defaultConfig.TELEGRAM_CONFIGURE_MENU, false);

  assert.throws(
    () =>
      loadApiConfig({
        DATABASE_URL: "postgresql://local",
        TELEGRAM_CONFIGURE_MENU: "true",
      }),
    /TELEGRAM_CONFIGURE_MENU requires TELEGRAM_BOT_TOKEN/,
  );

  const ownerConfig = loadApiConfig({
    DATABASE_URL: "postgresql://local",
    TELEGRAM_BOT_TOKEN: "test-bot-token",
    TELEGRAM_CONFIGURE_MENU: "true",
  });
  assert.equal(ownerConfig.TELEGRAM_CONFIGURE_MENU, true);
});
