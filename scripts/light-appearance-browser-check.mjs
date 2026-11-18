import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

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
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/public/v1/banners/")) {
      return json(res, { placementId: url.pathname.split("/").at(-1), enabled: false, slides: [] });
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
    res.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" });
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
          const match = value.match(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)/);
          return match
            ? [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4] ?? 1)]
            : null;
        };
        const luminance = ([r, g, b]) =>
          [r, g, b]
            .map((channel) => channel / 255)
            .map((channel) =>
              channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
            )
            .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
        const ratio = (a, b) => {
          const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
          return (values[0] + 0.05) / (values[1] + 0.05);
        };
        const visible = (element) => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            Number(style.opacity) > 0 &&
            rect.width > 0 &&
            rect.height > 0
          );
        };
        const background = (element) => {
          let current = element;
          let media = false;
          while (current) {
            const style = getComputedStyle(current);
            if (style.backgroundImage !== "none") media = true;
            const parsed = parse(style.backgroundColor);
            if (parsed && parsed[3] >= 0.98) return { rgb: parsed, media };
            current = current.parentElement;
          }
          return { rgb: [240, 242, 245, 1], media };
        };
        const rows = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const text = walker.currentNode.textContent?.trim();
          const element = walker.currentNode.parentElement;
          if (!text || !element || !visible(element)) continue;
          const color = parse(getComputedStyle(element).color);
          const bg = background(element);
          if (!color) continue;
          const contrast = ratio(color, bg.rgb);
          if (contrast < 4.5 && !bg.media) {
            rows.push({
              text: text.slice(0, 80),
              element: element.tagName.toLowerCase(),
              className: typeof element.className === "string" ? element.className : "",
              foreground: getComputedStyle(element).color,
              background: `rgb(${bg.rgb.slice(0, 3).join(", ")})`,
              contrast,
            });
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
          violations: rows,
          appearance,
        };
      });
      const name = `${theme}-${width}-${route === "/" ? "home" : route.slice(1).replaceAll("/", "-")}`;
      await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
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
    }
  }
  console.log(
    JSON.stringify(
      report.map(({ route, width, theme, documentWidth, errors, violations }) => ({
        route,
        width,
        theme,
        documentWidth,
        errors,
        violations,
      })),
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
