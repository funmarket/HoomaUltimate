import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const storage = new Map();
let prefersLight = false;

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem(key) {
        return storage.get(key) ?? null;
      },
      setItem(key, value) {
        storage.set(key, value);
      }
    },
    matchMedia() {
      return {
        get matches() {
          return prefersLight;
        },
        addEventListener() {}
      };
    }
  }
});

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    documentElement: {
      dataset: {},
      style: {}
    }
  }
});

const theme = await import("../apps/web/src/settings/theme.ts");

test("Future Pitch persists through the existing web appearance storage key", () => {
  storage.clear();
  theme.saveWebAppearanceMode("future-pitch");

  assert.equal(storage.get("hooma-web-appearance"), "future-pitch");
  assert.equal(theme.getWebAppearanceMode(), "future-pitch");
  assert.equal(document.documentElement.dataset.theme, "future-pitch");
  assert.equal(document.documentElement.style.colorScheme, "dark");
});

test("System theme still resolves from browser preference", () => {
  storage.clear();
  prefersLight = true;
  theme.saveWebAppearanceMode("system");
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(document.documentElement.style.colorScheme, "light");

  prefersLight = false;
  theme.applyWebAppearanceMode("system");
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(document.documentElement.style.colorScheme, "dark");
});

test("Settings exposes exactly four independent web theme choices", async () => {
  const source = await readFile(new URL("../apps/web/src/settings/SettingsPage.tsx", import.meta.url), "utf8");
  const values = [...source.matchAll(/value: "([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(values, ["system", "dark", "light", "future-pitch"]);
  assert.match(source, /label: "Pitch black \/ gold"/);
  assert.match(source, /label: "FUTURE PITCH"/);
  assert.match(source, /Dark futuristic football presentation with electric live-match accents\./);
});

test("Future Pitch applies before the app bundle to avoid a saved-theme flash", async () => {
  const source = await readFile(new URL("../apps/web/index.html", import.meta.url), "utf8");
  const initializer = source.indexOf("hooma-web-appearance");
  const moduleEntry = source.indexOf('src="/src/main.tsx"');

  assert.ok(initializer >= 0);
  assert.ok(moduleEntry > initializer);
  assert.match(source, /saved === "future-pitch"/);
});

test("Future Pitch canonical tokens remain centralized in the root theme stylesheet", async () => {
  const source = await readFile(new URL("../apps/web/src/theme.css", import.meta.url), "utf8");

  assert.match(source, /:root\[data-theme="future-pitch"\]/);
  assert.match(source, /--bg-deep: #020302;/);
  assert.match(source, /--lime: #b9ff31;/);
  assert.match(source, /--electric-blue: #67b8ff;/);
  assert.match(source, /--gold: #d0a14a;/);
  assert.match(source, /--success: #53da88;/);
  assert.match(source, /--danger: #ff626e;/);
});
