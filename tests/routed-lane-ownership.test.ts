import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import ts from "typescript";

const routerPath = resolve("apps/web/src/app/router/HoomaRouter.tsx");
const program = ts.createProgram([routerPath], {
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  target: ts.ScriptTarget.ES2022,
  baseUrl: process.cwd(),
  paths: {
    "@hooma/frontend": ["packages/frontend/src/index.ts"],
    "@hooma/ui": ["packages/ui/src/index.tsx"],
  },
});
const checker = program.getTypeChecker();
const router = program.getSourceFile(routerPath)!;
const visited = new Set<ts.Node>();
const owners = new Set<string>();

function attribute(open: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return open.attributes.properties.find(
    (entry): entry is ts.JsxAttribute => ts.isJsxAttribute(entry) && entry.name.getText() === name,
  );
}

function resolveDeclaration(node: ts.Node): ts.Declaration | undefined {
  let symbol = checker.getSymbolAtLocation(node);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol?.valueDeclaration ?? symbol?.declarations?.[0];
}

function inspectDeclaration(declaration: ts.Declaration): void {
  if (visited.has(declaration)) return;
  visited.add(declaration);
  if (ts.isFunctionDeclaration(declaration) && declaration.body) {
    let renders = 0;
    function returns(node: ts.Node): void {
      if (node !== declaration && ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression) {
        const expression = node.expression;
        if (containsPresentation(expression)) {
          renders++;
          inspectExpression(expression);
        }
        return;
      }
      ts.forEachChild(node, returns);
    }
    returns(declaration);
    assert.ok(renders, `No presentation traced for ${declaration.name?.text}`);
    return;
  }
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    // Lazy route entries resolve the actual imported source rather than a stale route list.
    const imports: string[] = [];
    const exportNames: string[] = [];
    function discover(node: ts.Node): void {
      if (
        ts.isPropertyAssignment(node) &&
        node.name.getText() === "default" &&
        ts.isPropertyAccessExpression(node.initializer)
      ) {
        exportNames.push(node.initializer.name.text);
      }
      if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) imports.push(argument.text);
      }
      ts.forEachChild(node, discover);
    }
    discover(declaration.initializer);
    if (imports.length) {
      for (const specifier of imports) {
        const file = resolve(declaration.getSourceFile().fileName, "..", `${specifier}.tsx`);
        const source = program.getSourceFile(file);
        assert.ok(source, `Missing lazy source ${file}`);
        const exported = source.statements.filter(
          (node): node is ts.FunctionDeclaration =>
            ts.isFunctionDeclaration(node) &&
            Boolean(node.name && exportNames.includes(node.name.text)) &&
            Boolean(
              node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword),
            ),
        );
        assert.equal(exported.length, 1, `Lazy entry must identify its rendered export: ${file}`);
        inspectDeclaration(exported[0]);
      }
    } else inspectExpression(declaration.initializer);
    return;
  }
  assert.fail(`Untraced presentation declaration ${declaration.getText().slice(0, 100)}`);
}

function containsPresentation(node: ts.Node): boolean {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node))
    return true;
  return ts.forEachChild(node, containsPresentation) ?? false;
}

function assertNoNestedLane(node: ts.Node, seen = new Set<ts.Node>()): void {
  if (seen.has(node)) return;
  seen.add(node);
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    const open = ts.isJsxElement(node) ? node.openingElement : node;
    const className = attribute(open, "className")?.initializer;
    assert.ok(
      !(className && ts.isStringLiteral(className) && /^hooma-lane--/.test(className.text)),
      `Nested lane would apply the global inset twice: ${node.getSourceFile().fileName}:${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
    );
    if (/^[A-Z]/.test(open.tagName.getText())) {
      const declaration = resolveDeclaration(open.tagName);
      if (declaration && declaration.getSourceFile().fileName.includes("/src/"))
        assertNoNestedLane(declaration, seen);
    }
  }
  ts.forEachChild(node, (child) => assertNoNestedLane(child, seen));
}

function inspectExpression(node: ts.Node): void {
  if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
    const open = ts.isJsxElement(node) ? node.openingElement : node;
    const tag = open.tagName.getText();
    const className = attribute(open, "className")?.initializer;
    const lane =
      className && ts.isStringLiteral(className)
        ? className.text.match(/(?:^|\s)hooma-lane--(media|nav|content|bleed)(?:\s|$)/)?.[1]
        : undefined;
    if (lane) {
      assert.equal(tag, "div", "Lane padding belongs to a neutral outer wrapper");
      assert.ok(
        ts.isJsxElement(node) &&
          node.children.some((child) => !ts.isJsxText(child) || child.text.trim()),
      );
      owners.add(lane);
      if (ts.isJsxElement(node)) for (const child of node.children) assertNoNestedLane(child);
      return;
    }
    if (tag === "Navigate" || tag === "style") return;
    if (/^[A-Z]/.test(tag)) {
      const declaration = resolveDeclaration(open.tagName);
      assert.ok(declaration, `Unresolved top-level component ${tag}`);
      inspectDeclaration(declaration);
      return;
    }
    // Router-owned loading/auth states stay read-only and use explicit shared status outer geometry.
    if (
      node.getSourceFile() === router &&
      tag === "p" &&
      className &&
      ts.isStringLiteral(className) &&
      className.text === "status"
    ) {
      const css = readFileSync("apps/web/src/styles.css", "utf8");
      assert.match(css, /\.foundation-shell > \.shell-content > \.status/);
      assert.match(css, /margin-left:\s*max\(\s*var\(--hooma-ui-lane-content-inline\)/);
      owners.add("content");
      return;
    }
    assert.ok(ts.isJsxElement(node), `Unowned top-level ${tag}`);
    const children = node.children.filter((child) => !ts.isJsxText(child) || child.text.trim());
    assert.ok(children.length, `Unowned empty top-level ${tag}`);
    for (const child of children) {
      assert.ok(
        !ts.isJsxText(child),
        `Unowned top-level copy in ${tag}: ${node.getSourceFile().fileName}`,
      );
      inspectExpression(child);
    }
    return;
  }
  if (ts.isIdentifier(node)) {
    const declaration = resolveDeclaration(node);
    if (
      declaration &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      containsPresentation(declaration.initializer)
    )
      inspectDeclaration(declaration);
    return;
  }
  ts.forEachChild(node, inspectExpression);
}

test("current router presentation graph owns normal and alternate top-level states through global lanes", () => {
  const routes: ts.JsxSelfClosingElement[] = [];
  function census(node: ts.Node): void {
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText() === "Route" &&
      attribute(node, "path")
    )
      routes.push(node);
    ts.forEachChild(node, census);
  }
  census(router);
  assert.ok(routes.length > 0);
  for (const route of routes) {
    const element = attribute(route, "element")?.initializer;
    assert.ok(element, `Missing route element: ${route.getText()}`);
    inspectExpression(element);
  }
  assert.ok(owners.has("media"));
  assert.ok(owners.has("nav"));
  assert.ok(owners.has("content"));
  assert.ok(!owners.has("bleed"), "No shipped top-level BLEED region has been established");
});

test("a lane wrapper preserves sticky navigation travel and fluid root width", () => {
  const css = readFileSync("apps/web/src/admin/admin.css", "utf8");
  const shell = readFileSync("apps/web/src/admin/ControlRoomShell.tsx", "utf8");
  assert.match(shell, /className="hooma-lane--nav admin-navigation-lane"/);
  assert.match(
    css,
    /\.admin-navigation-lane\s*\{[^}]*position:\s*sticky;[^}]*top:\s*8px;[^}]*z-index:\s*4;/,
  );
  assert.doesNotMatch(css, /width:\s*calc\(100vw - 64px\)/);
});

test("lane ownership preserves constrained hero layout and centered pagination", () => {
  const page = readFileSync("packages/frontend/src/teams/TeamsPage.tsx", "utf8");
  const css = readFileSync("packages/frontend/src/teams/teams.css", "utf8");
  assert.match(page, /className="hooma-lane--content teams-load-more-lane"/);
  assert.match(css, /\.teams-load-more-lane\s*\{\s*display:\s*grid;/);
  assert.match(css, /\.teams-hero-pro > div:first-child\s*\{\s*min-width:\s*0;/);
});
