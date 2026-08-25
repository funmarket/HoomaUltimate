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
      },
    },
    matchMedia() {
      return {
        get matches() {
          return prefersLight;
        },
        addEventListener() {},
      };
    },
  },
});

Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    documentElement: {
      dataset: {},
      style: {},
    },
  },
});

const theme = await import("../apps/web/src/settings/theme.ts");

test("System is the default when no web appearance is saved", () => {
  storage.clear();
  assert.equal(theme.getWebAppearanceMode(), "system");
});

test("removed or unknown saved appearances fall back to System", () => {
  storage.clear();
  storage.set("hooma-web-appearance", "future-pitch");
  assert.equal(theme.getWebAppearanceMode(), "system");

  storage.set("hooma-web-appearance", "unknown-theme");
  assert.equal(theme.getWebAppearanceMode(), "system");
});

test("System stays dark even when the browser prefers light", () => {
  storage.clear();
  prefersLight = true;
  theme.saveWebAppearanceMode("system");
  assert.equal(document.documentElement.dataset.appearance, "system");
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(document.documentElement.style.colorScheme, "dark");

  prefersLight = false;
  theme.applyWebAppearanceMode("system");
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(document.documentElement.style.colorScheme, "dark");
});

test("Light remains an explicit opt-in appearance", () => {
  storage.clear();
  theme.saveWebAppearanceMode("light");
  assert.equal(document.documentElement.dataset.appearance, "light");
  assert.equal(document.documentElement.dataset.theme, "light");
  assert.equal(document.documentElement.style.colorScheme, "light");
});

test("Settings exposes only System, dark, and light web appearances", async () => {
  const source = await readFile(
    new URL("../apps/web/src/settings/SettingsPage.tsx", import.meta.url),
    "utf8",
  );
  const values = [...source.matchAll(/value: "([^"]+)"/g)].map((match) => match[1]);

  assert.deepEqual(values, ["system", "dark", "light"]);
  assert.match(source, /label: "Pitch black \/ gold"/);
  assert.match(source, /description: "Use HOOMA's default black system appearance\."/);
  assert.doesNotMatch(source, /future-pitch|FUTURE PITCH/i);
});

test("System is dark before the app bundle without a white theme flash", async () => {
  const source = await readFile(new URL("../apps/web/index.html", import.meta.url), "utf8");
  const initializer = source.indexOf("hooma-web-appearance");
  const moduleEntry = source.indexOf('src="/src/main.tsx"');

  assert.ok(initializer >= 0);
  assert.ok(moduleEntry > initializer);
  assert.match(source, /mode === "system" \? "dark" : mode/);
  assert.doesNotMatch(source, /prefers-color-scheme/);
  assert.doesNotMatch(source, /future-pitch/i);
});

test("root System-dark stylesheet is true black", async () => {
  const source = await readFile(new URL("../apps/web/src/theme.css", import.meta.url), "utf8");

  assert.doesNotMatch(source, /future-pitch/i);
  assert.doesNotMatch(source, /--electric-blue|--bg-deep|--lime-bright/);
  assert.doesNotMatch(source, /:root\[data-appearance="dark"\]/);
  assert.match(source, /:root\[data-appearance="system"\]\[data-theme="dark"\]/);
  assert.match(source, /--app-bg:\s*#000000/);
  assert.match(
    source,
    /:root\[data-appearance="system"\]\[data-theme="dark"\] body\s*\{\s*background:\s*#000000/,
  );
  assert.match(source, /:root\[data-theme="light"\]/);
});
