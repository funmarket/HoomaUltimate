import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

function rulesFor(css: string, selector: string): string[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1].split(",").some((entry) => entry.trim() === selector))
    .map((match) => match[2]);
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

test("LEGACY owns routed-content outer spacing while the whole shell stays neutral", () => {
  assert.equal(
    declarations(standaloneRule(styles, ":root"))["--shell-inline"],
    "clamp(12px, 6vw, 24px)",
  );
  assert.equal(rulesFor(styles, ".foundation-shell--inline-legacy").length, 0);
  const legacy = rulesFor(styles, ".foundation-shell--inline-legacy > .shell-content");
  assert.equal(legacy.length, 2, "Compatibility keeps the existing desktop/mobile safe-area inset");
  for (const rule of legacy) {
    assert.match(rule, /margin-left:\s*max\(\s*var\(--shell-inline\)/);
    assert.match(rule, /margin-right:\s*max\(\s*var\(--shell-inline\)/);
    assert.match(rule, /--hooma-safe-area-inset-left/);
    assert.match(rule, /--hooma-content-safe-area-inset-right/);
    assert.doesNotMatch(rule, /padding/);
  }
  const edge = standaloneRule(styles, ".foundation-shell--inline-edge-capable > .shell-content");
  assert.doesNotMatch(edge, /--shell-inline/);
  assert.deepEqual(declarations(edge), { "margin-inline": "0" });
});

test("shell-owned statuses share LEGACY outer geometry without changing panel interior spacing", () => {
  const content = rulesFor(styles, ".foundation-shell--inline-legacy > .shell-content");
  const statuses = rulesFor(styles, ".foundation-shell--inline-legacy > .status");
  assert.equal(statuses.length, 2);
  assert.deepEqual(statuses, content);
  assert.equal(declarations(standaloneRule(styles, ".status")).padding, "16px");
  assert.match(shell, /<p className="status success"/);
  assert.match(shell, /<p className="status">/);
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
    const rule = declarations(standaloneRule(styles, `.hooma-lane--${lane}`));
    for (const side of ["left", "right"]) {
      assert.ok(rule[`padding-${side}`], `${lane} must protect the ${side} safe area`);
      assert.equal(
        rule[`padding-${side}`].replace(/\s+/g, " "),
        `max( var(${token}), calc(var(--hooma-safe-area-inset-${side}) + var(${token})), calc(var(--hooma-content-safe-area-inset-${side}) + var(${token})) )`,
      );
    }
  }
});

test("every registered route and representative resolved pathname is globally EDGE_CAPABLE", () => {
  assert.deepEqual(SHELL_INLINE_PRESENTATION, { LEGACY: "legacy", EDGE_CAPABLE: "edge-capable" });
  const patterns = [...router.matchAll(/\bpath="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(patterns.length > 0, "Route census must come from the current router");
  for (const pattern of patterns) {
    // Test-only segments exercise resolver paths; they do not identify product records.
    const pathname = pattern
      .replace(/:[^/]+/g, "contract-parameter")
      .replace(/\*/g, "contract-fallback");
    for (const path of [pattern, pathname, pathname === "/" ? "/" : `${pathname}/`]) {
      assert.equal(
        shellInlinePresentationForPath(path),
        SHELL_INLINE_PRESENTATION.EDGE_CAPABLE,
        path,
      );
    }
  }
  assert.equal(
    shellInlinePresentationForPath("/__shell_contract_unregistered__"),
    SHELL_INLINE_PRESENTATION.EDGE_CAPABLE,
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

test("global horizontal adoption ignores pathname mechanically and retains compatibility definitions", () => {
  const resolver = shellInlinePresentationForPath.toString();
  assert.match(resolver, /void pathname/);
  assert.match(resolver, /return .*EDGE_CAPABLE/);
  assert.doesNotMatch(resolver, /switch|case|if\s*\(|pathname\s*===|LEGACY/);
  assert.match(styles, /foundation-shell--inline-legacy/);
});
