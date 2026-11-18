import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import {
  contrastAfterOpacity,
  hasOverlappingMedia,
  samplePixelsInRect,
} from "./light-appearance-contrast.mjs";

const dist = resolve(process.argv[2]);
const output = resolve(process.argv[3]);
const theme = process.argv[4] ?? "light";
assert(theme === "light" || theme === "dark", "Expected light or dark appearance");
assert(process.env.LIGHT_PLAYWRIGHT_MODULE, "LIGHT_PLAYWRIGHT_MODULE is required");
const { chromium } = await import(pathToFileURL(process.env.LIGHT_PLAYWRIGHT_MODULE).href);
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
    if (url.pathname === "/api/public/v1/events") return json(res, { items: [], nextCursor: null });
    if (url.pathname === "/api/public/v1/athletes")
      return json(res, { items: [athlete], nextCursor: null });
    if (url.pathname === "/api/public/v1/teams/team-fixture") return json(res, teamDetail);
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
      deviceScaleFactor: 1,
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
          const match = value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)/);
          return match
            ? [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 1)]
            : null;
        };
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return false;
          for (let current = element; current; current = current.parentElement) {
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
        const opacityRoots = [];
        const opacityContext = (element) => {
          const opacityNodes = [];
          for (let current = element; current; current = current.parentElement) {
            const opacity = Number(getComputedStyle(current).opacity);
            if (opacity < 1) opacityNodes.push({ node: current, opacity });
          }
          const outermost = opacityNodes.at(-1);
          let opacityRootId = null;
          if (outermost) {
            opacityRootId = outermost.node.getAttribute("data-contrast-audit-opacity-root");
            if (!opacityRootId) {
              opacityRootId = `group-${opacityRoots.length}`;
              outermost.node.setAttribute("data-contrast-audit-opacity-root", opacityRootId);
              opacityRoots.push({ id: opacityRootId, opacity: outermost.opacity });
            }
          }
          return {
            opacityRootId,
            groupOpacity: outermost?.opacity ?? 1,
            foregroundOpacity: opacityNodes
              .filter((entry) => entry !== outermost)
              .reduce((value, entry) => value * entry.opacity, 1),
          };
        };
        const mediaRects = Array.from(document.querySelectorAll("img, video, canvas, svg image"))
          .filter(visible)
          .map((media) => {
            const rect = media.getBoundingClientRect();
            const loaded =
              media.tagName.toLowerCase() === "img"
                ? media.complete && media.naturalWidth > 0
                : media.tagName.toLowerCase() === "video"
                  ? media.readyState >= 2
                  : true;
            return {
              rect: [
                rect.left + window.scrollX,
                rect.top + window.scrollY,
                rect.right + window.scrollX,
                rect.bottom + window.scrollY,
              ],
              loaded,
            };
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
          const context = opacityContext(element);
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          pairs.push({
            text: text.slice(0, 80),
            element: element.tagName.toLowerCase(),
            className: typeof element.className === "string" ? element.className : "",
            foreground,
            foregroundOpacity: foregroundOpacity * context.foregroundOpacity,
            minimumContrast,
            kind,
            rect: [
              rect.left + window.scrollX,
              rect.top + window.scrollY,
              rect.right + window.scrollX,
              rect.bottom + window.scrollY,
            ],
            mediaRects,
            opacityRootId: context.opacityRootId,
            groupOpacity: context.groupOpacity,
            usesTextBackground: /text/i.test(style.backgroundClip),
          });
        };
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const text = walker.currentNode.textContent?.trim();
          const element = walker.currentNode.parentElement;
          if (!text || !element || !visible(element)) continue;
          const color = parse(getComputedStyle(element).color);
          addPair(element, text, color);
        }

        for (const element of document.querySelectorAll(
          "input[placeholder], textarea[placeholder]",
        )) {
          if (!visible(element) || element.value || !element.placeholder) continue;
          const style = getComputedStyle(element, "::placeholder");
          const foreground = parse(style.color);
          const styleOpacity = Number(style.opacity);
          addPair(
            element,
            `placeholder: ${element.placeholder}`,
            foreground,
            Number.isFinite(styleOpacity) ? styleOpacity : 1,
          );
        }
        for (const svg of document.querySelectorAll("svg")) {
          if (!visible(svg)) continue;
          const shape = svg.querySelector("path, circle, rect, line, polyline, polygon");
          const shapeStyle = shape ? getComputedStyle(shape) : getComputedStyle(svg);
          const fill = parse(shapeStyle.fill);
          const stroke = parse(shapeStyle.stroke);
          const foreground =
            (stroke && stroke[3] > 0 && stroke) ||
            (fill && fill[3] > 0 && fill) ||
            parse(getComputedStyle(svg).color);
          addPair(svg, "SVG icon", foreground, 1, 3, "icon");
        }

        for (const control of document.querySelectorAll(
          'input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"], [aria-checked]',
        )) {
          if (!visible(control)) continue;
          const style = getComputedStyle(control);
          if (style.borderStyle === "none" || style.borderWidth === "0px") continue;
          const border = parse(style.borderTopColor);
          addPair(control, "selection control border", border, 1, 3, "border");
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
              className: typeof element.className === "string" ? element.className : "",
              rect: [rounded(rect.x), rounded(rect.y), rounded(rect.width), rounded(rect.height)],
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
              typography: [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight],
              effects: [style.boxShadow, style.opacity, style.display, style.visibility],
              before: [before.content, before.color, before.backgroundColor],
              after: [after.content, after.color, after.backgroundColor],
            };
          });
        return {
          title: document.title,
          theme: document.documentElement.dataset.theme,
          text: document.body.innerText.slice(0, 200),
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
          opacityRoots,
          pairs,
          appearance,
        };
      });
      const hideForegroundStyle = await page.addStyleTag({
        content: `
          *, *::before, *::after {
            color: transparent !important;
            -webkit-text-fill-color: transparent !important;
            -webkit-text-stroke-color: transparent !important;
            text-shadow: none !important;
            caret-color: transparent !important;
          }
          svg, svg * {
            fill: transparent !important;
            stroke: transparent !important;
          }
          input::placeholder, textarea::placeholder {
            color: transparent !important;
            opacity: 0 !important;
          }
        `,
      });
      const surfaceOpacityStyle = result.opacityRoots.length
        ? await page.addStyleTag({
            content: "[data-contrast-audit-opacity-root] { opacity: 1 !important; }",
          })
        : null;
      const surfaceImage = await sharp(await page.screenshot({ fullPage: true }))
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      let backdropImage = null;
      if (result.opacityRoots.length) {
        await surfaceOpacityStyle.evaluate((element) => element.remove());
        const backdropStyle = await page.addStyleTag({
          content: "[data-contrast-audit-opacity-root] { visibility: hidden !important; }",
        });
        backdropImage = await sharp(await page.screenshot({ fullPage: true }))
          .ensureAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
        await backdropStyle.evaluate((element) => element.remove());
      }
      await hideForegroundStyle.evaluate((element) => element.remove());
      const scaleX = surfaceImage.info.width / width;
      const scaleY = surfaceImage.info.height / result.documentHeight;
      const violations = [];
      const unverifiedBackgrounds = [];
      for (const pair of result.pairs) {
        const overlappingMedia = pair.mediaRects.filter((media) =>
          hasOverlappingMedia(pair.rect, [media.rect]),
        );
        if (
          !pair.foreground ||
          pair.usesTextBackground ||
          overlappingMedia.some((media) => !media.loaded)
        ) {
          unverifiedBackgrounds.push({
            kind: pair.kind,
            text: pair.text,
            element: pair.element,
            className: pair.className,
            layers: !pair.foreground
              ? ["computed foreground color could not be parsed"]
              : pair.usesTextBackground
                ? ["text is painted from a CSS background image"]
                : ["overlapping image or video is not loaded"],
          });
          continue;
        }
        const surfaces = samplePixelsInRect({
          data: surfaceImage.data,
          width: surfaceImage.info.width,
          height: surfaceImage.info.height,
          channels: surfaceImage.info.channels,
          rect: pair.rect,
          scaleX,
          scaleY,
        });
        const backdrops = pair.opacityRootId
          ? samplePixelsInRect({
              data: backdropImage.data,
              width: backdropImage.info.width,
              height: backdropImage.info.height,
              channels: backdropImage.info.channels,
              rect: pair.rect,
              scaleX: backdropImage.info.width / width,
              scaleY: backdropImage.info.height / result.documentHeight,
            })
          : [];
        if (!surfaces.length || (pair.opacityRootId && surfaces.length !== backdrops.length)) {
          unverifiedBackgrounds.push({
            kind: pair.kind,
            text: pair.text,
            element: pair.element,
            className: pair.className,
            layers: ["no matching rendered background pixels were captured"],
          });
          continue;
        }
        let worst = null;
        for (let index = 0; index < surfaces.length; index += 1) {
          const measurement = contrastAfterOpacity({
            foreground: pair.foreground,
            surface: surfaces[index],
            backdrop: pair.opacityRootId ? backdrops[index] : [0, 0, 0, 0],
            foregroundOpacity: pair.foregroundOpacity,
            groupOpacity: pair.groupOpacity,
          });
          if (!worst || measurement.ratio < worst.ratio) worst = measurement;
        }
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
  await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2));
  for (const row of report) {
    assert.equal(row.theme, theme, `${row.route} did not resolve ${theme} appearance`);
    assert.deepEqual(row.errors, [], `${row.route} raised browser errors at ${row.width}px`);
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
        ({ route, width, theme, documentWidth, errors, violations, unverifiedBackgrounds }) => ({
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
