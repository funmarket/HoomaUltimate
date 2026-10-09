import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Match the leaf-rule inspection used by shell-inline-presentation.test.ts.
// Keep declarations as entries rather than collapsing duplicate properties.
function cssRules(css) {
  const uncommented = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...uncommented.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(",").map((selector) => selector.trim()),
    nodes: match[2]
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const colon = entry.indexOf(":");
        assert.ok(colon > 0, `Invalid declaration: ${entry}`);
        return { prop: entry.slice(0, colon).trim(), value: entry.slice(colon + 1).trim() };
      }),
  }));
}

const stylesheet = (path) => cssRules(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"));

function declarations(path, selector, property) {
  const matches = [];
  for (const rule of stylesheet(path)) {
    if (
      rule.selectors.includes(selector) &&
      (!property || rule.nodes.some((node) => node.prop === property))
    ) {
      matches.push(rule);
    }
  }
  assert.equal(matches.length, 1, `${selector} must have one owning rule`);
  return new Map(matches[0].nodes.map((node) => [node.prop, node.value]));
}

const discovery = "packages/frontend/src/discovery/hooma-now.css";
const athletes = "packages/frontend/src/athletes/athletes.css";
const watch = "packages/frontend/src/watch/watch.css";
const hooma = "packages/frontend/src/communities/hooma-page-semantic.css";

for (const [path, selector] of [
  [discovery, ".hooma-now__intro"],
  [discovery, "p.hooma-now__state"],
  [discovery, ".hooma-now__state--error p"],
  [athletes, ".athletes-card p"],
  [watch, ".watch-empty-state p"],
  [hooma, ".hooma-page p"],
  [hooma, ".hooma-page p.muted"],
  [hooma, ".hooma-page span.muted"],
  [hooma, ".hooma-page .muted"],
  [hooma, ".hooma-page .hooma-hero p"],
  [hooma, ".hooma-page .hooma-create-callout span"],
  [hooma, ".hooma-page .hooma-card-copy p"],
]) {
  test(`${selector} uses semantic body typography without competing declarations`, () => {
    const rule = declarations(path, selector, "font-size");
    assert.equal(rule.get("font-size"), "var(--hooma-ui-body)");
    assert.equal(rule.get("color"), "#f7f7f7");
    for (const property of ["font-size", "color"]) {
      let owners = 0;
      for (const candidate of stylesheet(path)) {
        if (!candidate.selectors.includes(selector)) continue;
        owners += candidate.nodes.filter((node) => node.prop === property).length;
      }
      assert.equal(owners, 1, `${selector} has one ${property} owner`);
    }
  });
}

test("body correction preserves captions, metadata and compact retry/navigation roles", () => {
  assert.equal(declarations(athletes, ".athletes-card__footer small").get("font-size"), "0.78rem");
  assert.equal(declarations(athletes, ".athletes-sport", "font-size").get("font-size"), "0.76rem");
  assert.equal(declarations(discovery, ".hooma-now__live", "font-size").get("font-size"), "12px");
  assert.equal(declarations(discovery, ".hooma-now__state--error button").get("font"), "inherit");
  assert.equal(declarations(discovery, ".hooma-now__state").has("font-size"), false);
  for (const selector of [
    ".hooma-page small",
    ".hooma-page .hooma-create-callout small",
    ".hooma-page .hooma-card-copy small",
  ]) {
    const rule = declarations(hooma, selector);
    assert.equal(rule.get("color"), "var(--hooma-page-muted)");
    assert.equal(rule.has("font-size"), false);
  }
  const navigation = declarations(
    "packages/frontend/src/communities/hooma-domain-links.css",
    ".hooma-page .hooma-domain-card span",
    "font-size",
  );
  assert.equal(navigation.get("font-size"), "13px");
});

test("CSS inspection retains grouped and media-query rules and duplicate declarations", () => {
  const rules = cssRules(`
    /* .copy { font-size: 1px; } */
    .copy, p.copy { font-size: var(--hooma-ui-body); color: #f7f7f7; }
    @media (max-width: 520px) {
      .copy { font-size: 14px; font-size: 16px; }
    }
  `);
  assert.equal(rules.length, 2);
  assert.deepEqual(rules[0].selectors, [".copy", "p.copy"]);
  assert.equal(rules[0].nodes[0].value, "var(--hooma-ui-body)");
  assert.deepEqual(rules[1].selectors, [".copy"]);
  assert.deepEqual(
    rules[1].nodes.filter((node) => node.prop === "font-size").map((node) => node.value),
    ["14px", "16px"],
  );
});
