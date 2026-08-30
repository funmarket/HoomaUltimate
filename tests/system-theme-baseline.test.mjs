import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const themeCss = new URL("../apps/web/src/theme.css", import.meta.url);
const themeRuntime = new URL("../apps/web/src/settings/theme.ts", import.meta.url);
const indexHtml = new URL("../apps/web/index.html", import.meta.url);

test("System dark remains distinct from the inherited explicit dark palette", async () => {
  const [css, runtime, html] = await Promise.all([
    readFile(themeCss, "utf8"),
    readFile(themeRuntime, "utf8"),
    readFile(indexHtml, "utf8"),
  ]);

  assert.match(runtime, /dataset\.appearance = mode/);
  assert.match(html, /document\.documentElement\.dataset\.appearance = mode/);
  assert.match(css, /:root\s*\{[\s\S]*--app-bg:\s*#070808/);
  assert.match(css, /:root\[data-appearance="system"\]\[data-theme="dark"\]/);
  assert.doesNotMatch(css, /:root\[data-appearance="dark"\]/);
});

test("System dark uses a true black application background", async () => {
  const css = await readFile(themeCss, "utf8");
  assert.match(
    css,
    /:root\[data-appearance="system"\]\[data-theme="dark"\][\s\S]*--app-bg:\s*#000000/,
  );
  assert.match(
    css,
    /:root\[data-appearance="system"\]\[data-theme="dark"\] body[\s\S]*background:\s*#000000/,
  );
});

test("canonical typography scale matches the approved readable sizes", async () => {
  const css = await readFile(themeCss, "utf8");
  assert.match(css, /--type-title:\s*clamp\(1\.5rem,[^;]*2\.125rem\)/);
  assert.match(css, /--type-section:\s*1\.375rem/);
  assert.match(css, /--type-body:\s*1rem/);
  assert.match(css, /--type-subtitle:\s*1rem/);
  assert.match(css, /--type-caption:\s*0\.8125rem/);
});

test("dark gold is bright metal instead of muted brass", async () => {
  const css = await readFile(themeCss, "utf8");
  assert.match(css, /:root\s*\{[\s\S]*--app-gold:\s*#e8c36a/);
  assert.match(css, /:root\s*\{[\s\S]*--app-text:\s*#f4f1ea/);
  assert.match(
    css,
    /:root\[data-appearance="system"\]\[data-theme="dark"\][\s\S]*--app-gold:\s*#e8c36a/,
  );
});
