import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as presentation from "../apps/web/src/app/shell/page-presentation.js";

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

test("routed content is neutral and temporary horizontal compatibility has no owner", () => {
  assert.doesNotMatch(styles, /--shell-inline|foundation-shell--inline-/);
  assert.doesNotMatch(shell, /shellInlinePresentation|foundation-shell--inline-/);
  assert.deepEqual(Object.keys(presentation).sort(), [
    "SHELL_PRESENTATION",
    "shellPresentationForPath",
  ]);
  assert.deepEqual(declarations(standaloneRule(styles, ".foundation-shell > .shell-content")), {
    "margin-inline": "0",
  });
});

test("router statuses retain shared CONTENT safe-area geometry and panel interior spacing", () => {
  const status = declarations(
    standaloneRule(styles, ".foundation-shell > .shell-content > .status"),
  );
  const content = declarations(standaloneRule(styles, ".hooma-lane--content"));
  for (const side of ["left", "right"]) {
    assert.equal(status[`margin-${side}`], content[`padding-${side}`]);
  }
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

test("all registered routes share the permanent shell with only vertical presentation", () => {
  const patterns = [...router.matchAll(/\bpath="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(patterns.length > 0, "Route census must come from the current router");
  assert.match(router, /<HoomaShell runtime=\{runtime\}>[\s\S]*<Routes>/);
  assert.match(shell, /const shellPresentation = shellPresentationForPath\(location\.pathname\)/);
  assert.match(shell, /className=\{`foundation-shell foundation-shell--\$\{shellPresentation\}`\}/);
  assert.deepEqual(presentation.SHELL_PRESENTATION, {
    STANDARD: "standard",
    MEDIA_FIRST: "media-first",
  });
  for (const pattern of patterns) {
    const pathname = pattern
      .replace(/:[^/]+/g, "contract-parameter")
      .replace(/\*/g, "contract-fallback");
    assert.equal(
      presentation.shellPresentationForPath(pathname),
      pathname === "/athletes"
        ? presentation.SHELL_PRESENTATION.MEDIA_FIRST
        : presentation.SHELL_PRESENTATION.STANDARD,
    );
  }
  assert.equal(
    presentation.shellPresentationForPath("/athletes/"),
    presentation.SHELL_PRESENTATION.MEDIA_FIRST,
  );
});

test("repository source and governing documents contain no stale horizontal migration references", () => {
  const files = execFileSync("git", ["-c", `safe.directory=${process.cwd()}`, "ls-files", "-z"], {
    encoding: "utf8",
  }).split("\0");
  for (const file of files) {
    // Tests retain negative assertions against removed identifiers as regression guards.
    if (!file || file.startsWith("tests/") || !/\.(?:[cm]?[jt]sx?|css|md|json|ya?ml)$/.test(file))
      continue;
    assert.doesNotMatch(
      readFileSync(file, "utf8"),
      /--shell-inline|foundation-shell--inline-|SHELL_INLINE_PRESENTATION|ShellInlinePresentation|shellInlinePresentation/,
      file,
    );
  }
});
