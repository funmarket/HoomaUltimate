import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const theme = readFileSync("apps/web/src/theme.css", "utf8");
const requestsCss = readFileSync("packages/frontend/src/requests/requests.css", "utf8");

test("canonical HOOMA UI tokens define the Requests visual foundation", () => {
  for (const token of [
    "--hooma-ui-bg: #050605;",
    "--hooma-ui-surface: #0b0c0a;",
    "--hooma-ui-outline: rgba(190, 180, 145, 0.22);",
    "--hooma-ui-accent: #aef02f;",
    "--hooma-ui-page-title: 24px;",
    "--hooma-ui-section-title: 20px;",
    "--hooma-ui-card-title: 17px;",
    "--hooma-ui-body: 16px;",
    "--hooma-ui-meta: 14px;",
  ]) {
    assert.ok(theme.includes(token), `missing canonical HOOMA token: ${token}`);
  }
});

test("Requests consumes the canonical outline without legacy gold container effects", () => {
  assert.ok(requestsCss.includes("border: 1px solid var(--hooma-ui-outline);"));
  assert.ok(requestsCss.includes("box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);"));
  assert.equal(requestsCss.includes("inset 0 0 0 1px var(--app-outline-gold)"), false);
  assert.equal(requestsCss.includes("var(--app-line)"), false);
  assert.equal(requestsCss.includes("var(--app-line-strong)"), false);
});

test("Requests primary interaction state uses remix green without filled-green buttons", () => {
  assert.ok(requestsCss.includes(".help-action--primary"));
  assert.ok(requestsCss.includes("border-color: var(--hooma-ui-accent);"));
  assert.ok(requestsCss.includes("color: var(--hooma-ui-accent);"));
  assert.equal(requestsCss.includes("background: var(--hooma-ui-accent);"), false);
});
