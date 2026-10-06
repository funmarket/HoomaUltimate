import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  SHELL_INLINE_PRESENTATION,
  shellInlinePresentationForPath,
} from "../apps/web/src/app/shell/page-presentation.js";

const styles = readFileSync("apps/web/src/styles.css", "utf8");
const theme = readFileSync("apps/web/src/theme.css", "utf8");
const shell = readFileSync("apps/web/src/app/shell/HoomaShell.tsx", "utf8");
const router = readFileSync("apps/web/src/app/router/HoomaRouter.tsx", "utf8");

function standaloneRule(css: string, selector: string): string {
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const matches = [...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(
    (match) => match[1].trim() === selector,
  );
  assert.equal(matches.length, 1, `${selector} must have one standalone rule`);
  return matches[0][2];
}

function declarations(rule: string): Record<string, string> {
  return Object.fromEntries(
    rule
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const colon = entry.indexOf(":");
        assert.ok(colon > 0, `Invalid declaration: ${entry}`);
        return [entry.slice(0, colon).trim(), entry.slice(colon + 1).trim()];
      }),
  );
}

test("base shell is horizontally neutral and retains its composition and bottom clearance", () => {
  const base = standaloneRule(styles, ".foundation-shell");
  assert.doesNotMatch(base, /--shell-inline/);
  assert.deepEqual(declarations(base), {
    width: "100%",
    "min-height": "100vh",
    "max-width": "960px",
    margin: "0 auto",
    padding: "0 0 48px",
    display: "grid",
    "align-content": "space-between",
    gap: "32px",
  });
});

test("ordinary Web compatibility belongs to LEGACY while EDGE_CAPABLE keeps zero inset", () => {
  assert.equal(
    declarations(standaloneRule(styles, ":root"))["--shell-inline"],
    "clamp(12px, 6vw, 24px)",
  );
  assert.deepEqual(declarations(standaloneRule(styles, ".foundation-shell--inline-legacy")), {
    "padding-inline": "var(--shell-inline)",
  });
  const edge = standaloneRule(styles, ".foundation-shell--inline-edge-capable");
  assert.doesNotMatch(edge, /--shell-inline/);
  assert.deepEqual(declarations(edge), { "padding-inline": "0" });
});

test("global lanes have one shared 8/8/16/0 authority and matching primitives", () => {
  const tokens = declarations(standaloneRule(theme, ":root"));
  assert.equal(tokens["--hooma-ui-page-inline"], "16px");
  for (const [lane, value] of Object.entries({
    media: "8px",
    nav: "8px",
    content: "var(--hooma-ui-page-inline)",
    bleed: "0px",
  })) {
    const token = `--hooma-ui-lane-${lane}-inline`;
    assert.equal(tokens[token], value);
    assert.equal([...`${theme}\n${styles}`.matchAll(new RegExp(`${token}\\s*:`, "g"))].length, 1);
    assert.deepEqual(declarations(standaloneRule(styles, `.hooma-lane--${lane}`)), {
      "padding-inline": `var(${token})`,
    });
  }
});

test("every registered route and representative resolved pathname remains LEGACY", () => {
  assert.deepEqual(SHELL_INLINE_PRESENTATION, { LEGACY: "legacy", EDGE_CAPABLE: "edge-capable" });
  const patterns = [...router.matchAll(/\bpath="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(patterns.length > 0, "Route census must come from the current router");
  for (const pattern of patterns) {
    // Test-only segments exercise resolver paths; they do not identify product records.
    const pathname = pattern
      .replace(/:[^/]+/g, "contract-parameter")
      .replace(/\*/g, "contract-fallback");
    for (const path of [pattern, pathname, pathname === "/" ? "/" : `${pathname}/`]) {
      assert.equal(shellInlinePresentationForPath(path), SHELL_INLINE_PRESENTATION.LEGACY, path);
    }
  }
  assert.equal(
    shellInlinePresentationForPath("/__shell_contract_unregistered__"),
    SHELL_INLINE_PRESENTATION.LEGACY,
  );
});

test("inline presentation composes globally without changing the vertical axis", () => {
  assert.match(
    shell,
    /const shellInlinePresentation = shellInlinePresentationForPath\(location\.pathname\)/,
  );
  assert.match(shell, /const shellPresentation = shellPresentationForPath\(location\.pathname\)/);
  assert.match(
    shell,
    /foundation-shell--\$\{shellPresentation\} foundation-shell--inline-\$\{shellInlinePresentation\}/,
  );
  assert.match(router, /<HoomaShell runtime=\{runtime\}>[\s\S]*<Routes>/);
  assert.doesNotMatch(
    shellInlinePresentationForPath.toString(),
    /\b(?:shellPresentationForPath|SHELL_PRESENTATION)\b/,
  );
});

test("no shipped frontend source adopts the inactive semantic lanes in Packet 2", () => {
  function inspect(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) inspect(path);
      else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
        assert.doesNotMatch(readFileSync(path, "utf8"), /hooma-lane--/, path);
      }
    }
  }
  for (const directory of ["apps/web/src", "packages/frontend/src", "packages/ui/src"])
    inspect(directory);
});
