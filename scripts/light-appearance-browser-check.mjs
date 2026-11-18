import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  contrastAfterOpacity,
  hasOverlappingMedia,
} from "./light-appearance-contrast.mjs";

const dist = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const theme = process.argv[4] ?? "light";
assert(
  theme === "light" || theme === "dark",
  "Expected light or dark appearance",
);
assert(
  process.env.LIGHT_PLAYWRIGHT_MODULE,
  "LIGHT_PLAYWRIGHT_MODULE is required",
);
const { chromium } = await import(
  pathToFileURL(process.env.LIGHT_PLAYWRIGHT_MODULE).href
);
await mkdir(output, { recursive: true });

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const athlete = {
  id: "athlete-fixture",
  slug: "cycling-fixture",
  name: "Cycling",
  description: "Train and compete with people nearby.",
  city: "Tunis",
  houma: "La Marsa",
  sport: "CYCLING",
  visibility: "PUBLIC",
  joinPolicy: "OPEN",
  logoUrl: null,
  bannerUrl: null,
  _count: { memberships: 12 },
};
const team = {
  id: "team-fixture",
  slug: "team-fixture",
  name: "HOOMA United",
  motto: "Built locally",
  city: "Tunis",
  houma: "La Marsa",
  badgeUrl: null,
  bannerUrl: null,
  communityId: null,
  _count: { players: 11 },
};
const teamDetail = {
  id: "team-fixture",
  communityId: null,
  slug: "team-fixture",
  name: team.name,
  motto: team.motto,
  city: team.city,
  houma: team.houma,
  badgeUrl: null,
  bannerUrl: null,
  community: null,
  players: [],
  responsibilities: [],
  lineups: [],
};
const community = {
  id: "community-fixture",
  slug: "community-fixture",
  name: "Carthage",
  description: "A local HOOMA community.",
  city: "Tunis",
  houma: "Carthage",
  logoUrl: null,
  bannerUrl: null,
  visibility: "PUBLIC",
  joinPolicy: "OPEN",
  status: "ACTIVE",
  role: null,
};

function json(res, value, status = 200) {
  res.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/public/v1/banners/")) {
      return json(res, {
        placementId: url.pathname.split("/").at(-1),
        enabled: false,
        slides: [],
      });
    }
    if (url.pathname === "/api/public/v1/auth/session") return json(res, null);
    if (url.pathname === "/api/public/v1/discovery/now")
      return json(res, {
        generatedAt: new Date().toISOString(),
        refreshAfterSeconds: 30,
        items: [],
      });
    if (url.pathname === "/api/public/v1/events")
      return json(res, { items: [], nextCursor: null });
    if (url.pathname === "/api/public/v1/athletes")
      return json(res, { items: [athlete], nextCursor: null });
    if (url.pathname === "/api/public/v1/teams/team-fixture")
      return json(res, teamDetail);
    if (url.pathname === "/api/public/v1/teams")
      return json(res, { items: [team], nextCursor: null });
    if (url.pathname === "/api/public/v1/communities")
      return json(res, { items: [community], nextCursor: null });
    if (url.pathname.startsWith("/api/"))
      return json(
        res,
        { error: { code: "NOT_FOUND", message: "Controlled browser fixture" } },
        404,
      );

    const filename = resolve(dist, `.${decodeURIComponent(url.pathname)}`);
    assert(filename === dist || filename.startsWith(dist + sep));
    const file = extname(filename) ? filename : resolve(dist, "index.html");
    res.writeHead(200, {
      "content-type": mime[extname(file)] ?? "application/octet-stream",
    });
    res.end(await readFile(file));
  } catch (error) {
    if (!res.headersSent) res.writeHead(500);
    res.end(String(error));
  }
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });

const routes = [
  "/",
  "/telegram",
  "/login",
  "/register",
  "/profile",
  "/settings",
  "/admin",
  "/play",
  "/watch",
  "/hooma",
  "/hooma/new",
  "/athletes",
  "/athletes/gear-up",
  "/teams",
  "/teams/new",
  "/teams/team-fixture",
  "/pitch",
  "/places",
  "/requests",
  "/rides",
  "/gamers",
];
const widths = [320, 390, 430, 1280];
const report = [];

try {
  for (const width of widths) {
    const context = await browser.newContext({
      viewport: { width, height: width < 500 ? 844 : 900 },
    });
    await context.addInitScript((appearance) => {
      localStorage.setItem("hooma-web-appearance", appearance);
    }, theme);
    for (const route of routes) {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(`${origin}${route}`, { waitUntil: "networkidle" });
      await page.addStyleTag({
        content:
          "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }",
      });
      await page.waitForTimeout(120);
      const result = await page.evaluate(() => {
        const parse = (value) => {
          const match = value.match(
            /rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)/,
          );
          return match
            ? [
                Number(match[1]),
                Number(match[2]),
                Number(match[3]),
                Number(match[4] ?? 1),
              ]
            : null;
        };
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;
          for (
            let current = element;
            current;
            current = current.parentElement
          ) {
            const style = getComputedStyle(current);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              Number(style.opacity) <= 0
            ) {
              return false;
            }
          }
          return true;
        };
        const cssColors = (image) => {
          const tokens =
            image.match(/rgba?\([^)]*\)|#[\da-f]{3,8}\b|transparent/gi) ?? [];
          return tokens
            .map((token) => {
              if (token.toLowerCase() === "transparent") return [0, 0, 0, 0];
              if (token.startsWith("#")) {
                const hex = token.slice(1);
                const expanded =
                  hex.length === 3 || hex.length === 4
                    ? [...hex].map((part) => part + part).join("")
                    : hex;
                return [
                  Number.parseInt(expanded.slice(0, 2), 16),
                  Number.parseInt(expanded.slice(2, 4), 16),
                  Number.parseInt(expanded.slice(4, 6), 16),
                  expanded.length === 8
                    ? Number.parseInt(expanded.slice(6, 8), 16) / 255
                    : 1,
                ];
              }
              return parse(token);
            })
            .filter(Boolean);
        };
        const background = (element) => {
          let current = element;
          const imageLayers = [];
          while (current) {
            const style = getComputedStyle(current);
            if (style.backgroundImage !== "none")
              imageLayers.push(style.backgroundImage);
            const parsed = parse(style.backgroundColor);
            if (parsed && parsed[3] >= 0.98) {
              const gradientSurfaces = imageLayers
                .filter((image) => /gradient\(/i.test(image))
                .flatMap(cssColors);
              const gradientLayers = imageLayers.filter((image) =>
                /gradient\(/i.test(image),
              );
              const unresolvedBackgrounds = imageLayers.filter(
                (image) =>
                  /\burl\(|image-set\(|paint\(/i.test(image) ||
                  !/gradient\(/i.test(image) ||
                  cssColors(image).length === 0,
              );
              if (gradientLayers.length > 1) {
                unresolvedBackgrounds.push(
                  "multiple gradient layers require raster evidence",
                );
              }
              return { rgb: parsed, gradientSurfaces, unresolvedBackgrounds };
            }
            current = current.parentElement;
          }
          const gradientSurfaces = imageLayers
            .filter((image) => /gradient\(/i.test(image))
            .flatMap(cssColors);
          const gradientLayers = imageLayers.filter((image) =>
            /gradient\(/i.test(image),
          );
          const unresolvedBackgrounds = imageLayers.filter(
            (image) =>
              /\burl\(|image-set\(|paint\(/i.test(image) ||
              !/gradient\(/i.test(image) ||
              cssColors(image).length === 0,
          );
          if (gradientLayers.length > 1) {
            unresolvedBackgrounds.push(
              "multiple gradient layers require raster evidence",
            );
          }
          return {
            rgb: [240, 242, 245, 1],
            gradientSurfaces,
            unresolvedBackgrounds,
          };
        };
        const opacityContext = (element) => {
          const opacityNodes = [];
          for (
            let current = element;
            current;
            current = current.parentElement
          ) {
            const opacity = Number(getComputedStyle(current).opacity);
            if (opacity < 1) opacityNodes.push({ node: current, opacity });
          }
          const groupOpacity = opacityNodes.reduce(
            (value, entry) => value * entry.opacity,
            1,
          );
          const outermost = opacityNodes.at(-1)?.node;
          const backdropBackground = outermost
            ? background(outermost.parentElement)
            : background(element);
          return {
            groupOpacity,
            backdrop: backdropBackground.rgb,
            unresolvedBackgrounds: backdropBackground.unresolvedBackgrounds,
          };
        };
        const mediaRects = Array.from(
          document.querySelectorAll("img, video, canvas, svg image"),
        )
          .filter(visible)
          .map((media) => {
            const rect = media.getBoundingClientRect();
            return [rect.left, rect.top, rect.right, rect.bottom];
          });
        const pairs = [];
        const addPair = (
          element,
          text,
          foreground,
          foregroundOpacity = 1,
          minimumContrast = 4.5,
          kind = "text",
        ) => {
          const bg = background(element);
          const context = opacityContext(element);
          const rect = element.getBoundingClientRect();
          pairs.push({
            text: text.slice(0, 80),
            element: element.tagName.toLowerCase(),
            className:
              typeof element.className === "string" ? element.className : "",
            foreground,
            foregroundOpacity,
            minimumContrast,
            kind,
            rect: [rect.left, rect.top, rect.right, rect.bottom],
            mediaRects,
            surface: bg.rgb,
            backdrop: context.backdrop,
            groupOpacity: context.groupOpacity,
            gradientSurfaces: bg.gradientSurfaces,
            unresolvedBackgrounds: [
              ...bg.unresolvedBackgrounds,
              ...context.unresolvedBackgrounds,
            ],
          });
        };
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
        );
        while (walker.nextNode()) {
          const text = walker.currentNode.textContent?.trim();
          const element = walker.currentNode.parentElement;
          if (!text || !element || !visible(element)) continue;
          const color = parse(getComputedStyle(element).color);
          if (color) addPair(element, text, color);
        }

        for (const element of document.querySelectorAll(
          "input[placeholder], textarea[placeholder]",
        )) {
          if (!visible(element) || element.value || !element.placeholder)
            continue;
          const style = getComputedStyle(element, "::placeholder");
          const foreground = parse(style.color);
          const styleOpacity = Number(style.opacity);
          if (foreground)
            addPair(
              element,
              `placeholder: ${element.placeholder}`,
              foreground,
              Number.isFinite(styleOpacity) ? styleOpacity : 1,
            );
        }
        for (const svg of document.querySelectorAll("svg")) {
          if (!visible(svg)) continue;
          const shape = svg.querySelector(
            "path, circle, rect, line, polyline, polygon",
          );
          const shapeStyle = shape
            ? getComputedStyle(shape)
            : getComputedStyle(svg);
          const fill = parse(shapeStyle.fill);
          const stroke = parse(shapeStyle.stroke);
          const foreground =
            (stroke && stroke[3] > 0 && stroke) ||
            (fill && fill[3] > 0 && fill) ||
            parse(getComputedStyle(svg).color);
          if (foreground) addPair(svg, "SVG icon", foreground, 1, 3, "icon");
        }

        for (const control of document.querySelectorAll(
          'input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], [aria-checked]',
        )) {
          if (!visible(control)) continue;
          const style = getComputedStyle(control);
          if (style.borderStyle === "none" || style.borderWidth === "0px")
            continue;
          const border = parse(style.borderTopColor);
          if (border && border[3] > 0) {
            addPair(
              control,
              "selection control border",
              border,
              1,
              3,
              "border",
            );
          }
        }

        const rounded = (value) => Math.round(value * 100) / 100;
        const appearance = Array.from(document.body.querySelectorAll("*"))
          .filter(visible)
          .map((element) => {
            const style = getComputedStyle(element);
            const before = getComputedStyle(element, "::before");
            const after = getComputedStyle(element, "::after");
            const rect = element.getBoundingClientRect();
            return {
              tag: element.tagName.toLowerCase(),
              className:
                typeof element.className === "string" ? element.className : "",
              rect: [
                rounded(rect.x),
                rounded(rect.y),
                rounded(rect.width),
                rounded(rect.height),
              ],
              color: style.color,
              backgroundColor: style.backgroundColor,
              border: [
                style.borderTopColor,
                style.borderRightColor,
                style.borderBottomColor,
                style.borderLeftColor,
                style.borderTopWidth,
                style.borderRightWidth,
                style.borderBottomWidth,
                style.borderLeftWidth,
              ],
              typography: [
                style.fontFamily,
                style.fontSize,
                style.fontWeight,
                style.lineHeight,
              ],
              effects: [
                style.boxShadow,
                style.opacity,
                style.display,
                style.visibility,
              ],
              before: [before.content, before.color, before.backgroundColor],
              after: [after.content, after.color, after.backgroundColor],
            };
          });
        return {
          title: document.title,
          theme: document.documentElement.dataset.theme,
          text: document.body.innerText.slice(0, 200),
          documentWidth: document.documentElement.scrollWidth,
          pairs,
          appearance,
        };
      });
      const violations = [];
      const unverifiedBackgrounds = [];
      for (const pair of result.pairs) {
        if (
          pair.unresolvedBackgrounds.length ||
          hasOverlappingMedia(pair.rect, pair.mediaRects)
        ) {
          unverifiedBackgrounds.push({
            kind: pair.kind,
            text: pair.text,
            element: pair.element,
            className: pair.className,
            layers: [
              ...pair.unresolvedBackgrounds,
              ...(hasOverlappingMedia(pair.rect, pair.mediaRects)
                ? ["overlapping media element requires raster evidence"]
                : []),
            ],
          });
          continue;
        }
        const surfaces = pair.gradientSurfaces.length
          ? pair.gradientSurfaces
          : [pair.surface];
        const measurements = surfaces.map((surface) =>
          contrastAfterOpacity({
            foreground: pair.foreground,
            surface,
            backdrop: pair.backdrop,
            foregroundOpacity: pair.foregroundOpacity,
            groupOpacity: pair.groupOpacity,
          }),
        );
        const worst = measurements.reduce((a, b) =>
          a.ratio <= b.ratio ? a : b,
        );
        if (worst.ratio < pair.minimumContrast) {
          violations.push({
            kind: pair.kind,
            text: pair.text,
            element: pair.element,
            className: pair.className,
            foreground: pair.foreground,
            background: worst.background,
            contrast: worst.ratio,
          });
        }
      }
      delete result.pairs;
      result.violations = violations;
      result.unverifiedBackgrounds = unverifiedBackgrounds;
      const name = `${theme}-${width}-${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}`;
      await page.screenshot({
        path: resolve(output, `${name}.png`),
        fullPage: true,
      });
      report.push({ route, width, errors, ...result });
      await page.close();
    }
    await context.close();
  }
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(report, null, 2),
  );
  for (const row of report) {
    assert.equal(
      row.theme,
      theme,
      `${row.route} did not resolve ${theme} appearance`,
    );
    assert.deepEqual(
      row.errors,
      [],
      `${row.route} raised browser errors at ${row.width}px`,
    );
    assert(
      row.documentWidth <= row.width + 1,
      `${row.route} overflowed horizontally at ${row.width}px`,
    );
    if (theme === "light") {
      assert.deepEqual(
        row.violations,
        [],
        `${row.route} has unreadable rendered foreground/background pairs at ${row.width}px`,
      );
      assert.deepEqual(
        row.unverifiedBackgrounds,
        [],
        `${row.route} has visible text over a background the checker cannot resolve at ${row.width}px`,
      );
    }
  }
  console.log(
    JSON.stringify(
      report.map(
        ({
          route,
          width,
          theme,
          documentWidth,
          errors,
          violations,
          unverifiedBackgrounds,
        }) => ({
          route,
          width,
          theme,
          documentWidth,
          errors,
          violations,
          unverifiedBackgrounds,
        }),
      ),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
