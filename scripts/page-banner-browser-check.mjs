// Browser lab only: real compiled application, controlled metadata/image latency.
// No live backend, credentials, Admin writes, or production performance claims.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const [baseDir, headDir, outputDir] = process.argv.slice(2);
assert(baseDir && headDir && outputDir, "Expected baseline dist, candidate dist, output dir");
const { chromium } = await import(pathToFileURL(process.env.BANNER_PLAYWRIGHT_MODULE).href);
const out = resolve(outputDir);
await mkdir(out, { recursive: true });
const metadataDelayMs = 180;
const imageDelayMs = 240;
const images = await Promise.all(
  ["#283f60", "#a54030"].map((background) =>
    sharp({ create: { width: 720, height: 300, channels: 3, background } })
      .png()
      .toBuffer(),
  ),
);
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};
const report = {
  environment:
    "CI Chromium; compiled app; synthetic banner/API fixtures; not live backend or Telegram",
  baselineSha: process.env.BANNER_BASE_SHA,
  candidateSha: process.env.BANNER_HEAD_SHA,
  metadataDelayMs,
  imageDelayMs,
  runs: [],
  widths: [],
};

async function serve(directory) {
  const root = resolve(directory);
  const state = { enabled: true, version: 0, sequence: 0, requests: [], unexpected: [] };
  const json = (res, value, status = 200) => {
    res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
    res.end(JSON.stringify(value));
  };
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method !== "GET") {
        state.unexpected.push(`${req.method} ${url.pathname}`);
        return json(res, { error: { message: "Fixture denies writes" } }, 405);
      }
      if (url.pathname.startsWith("/api/public/v1/banners/")) {
        const placementId = url.pathname.split("/").at(-1);
        const sequence = ++state.sequence;
        const version = state.version;
        const enabled = placementId !== "HOME_TOP" || state.enabled;
        state.requests.push({ type: "metadata", placementId, sequence, version });
        await pause(metadataDelayMs);
        return json(res, {
          placementId,
          enabled,
          slides: enabled
            ? [
                {
                  id: `${placementId}-slide`,
                  artworkVersion: `fixture-${version}`,
                  sortOrder: 0,
                  isDecorative: false,
                  altText: `Browser fixture ${version}`,
                  destination: null,
                  variants: [
                    {
                      variant: "master",
                      contentUrl: `/fixture/${placementId}/${version}.png?signature=${sequence}`,
                      expiresAt: new Date(Date.now() + 300_000).toISOString(),
                      contentType: "image/png",
                      widthPx: 720,
                      heightPx: 300,
                    },
                  ],
                },
              ]
            : [],
        });
      }
      if (url.pathname.startsWith("/fixture/")) {
        state.requests.push({ type: "image", path: req.url });
        await pause(imageDelayMs);
        res.writeHead(200, {
          "content-type": "image/png",
          "cache-control": "private, max-age=240",
        });
        return res.end(images[Number(url.pathname.split("/").at(-1).split(".")[0])]);
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
      if (url.pathname.startsWith("/api/")) {
        state.unexpected.push(`GET ${url.pathname}`);
        return json(
          res,
          { error: { code: "NOT_FOUND", message: "No browser fixture for this endpoint" } },
          404,
        );
      }
      const filename = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      assert(filename.startsWith(root + sep) || filename === root, "Path outside dist");
      const file = extname(filename) ? filename : resolve(root, "index.html");
      res.writeHead(200, { "content-type": mime[extname(file)] ?? "application/octet-stream" });
      res.end(await readFile(file));
    } catch (error) {
      if (!res.headersSent) res.writeHead(500);
      res.end(String(error));
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  return {
    state,
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((done) => server.close(done)),
  };
}

const browser = await chromium.launch({ headless: true });
const servers = [];
async function newPage(width = 390) {
  const context = await browser.newContext({
    viewport: { width, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.bannerLab = { observations: [], shifts: [], errors: [] };
    window.addEventListener("error", (event) => window.bannerLab.errors.push(event.message));
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        window.bannerLab.shifts.push({
          at: entry.startTime,
          value: entry.value,
          recentInput: entry.hadRecentInput,
        });
    }).observe({ type: "layout-shift", buffered: true });
    let previous = "";
    function sample() {
      const banner = document.querySelector('[data-page-banner][data-state="ready"]');
      const box = banner?.getBoundingClientRect();
      const next = `${location.pathname}:${banner?.getAttribute("data-placement") ?? "none"}:${Math.round(box?.height ?? 0)}`;
      if (next !== previous) {
        window.bannerLab.observations.push({ at: performance.now(), state: next });
        previous = next;
      }
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  });
  return { page, context };
}
async function ready(page, placement) {
  await page
    .locator(`[data-placement="${placement}"][data-state="ready"]`)
    .waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction((id) => {
    const image = document.querySelector(`[data-placement="${id}"] img:not([aria-hidden="true"])`);
    return image?.complete && image.naturalWidth > 0;
  }, placement);
  return page.evaluate((id) => {
    const events = window.bannerLab.observations.filter((item) => item.state.includes(`:${id}:`));
    return events.at(-1)?.at ?? performance.now();
  }, placement);
}
async function navigate(page, href, placement) {
  const startedAt = await page.evaluate(() => performance.now());
  await page.locator(`nav[aria-label="Primary"] a[href="${href}"]`).click();
  await ready(page, placement);
  return (await page.evaluate(() => performance.now())) - startedAt;
}

try {
  for (const [label, dir] of [
    ["baseline", baseDir],
    ["candidate", headDir],
  ]) {
    const server = await serve(dir);
    servers.push(server);
    for (let iteration = 1; iteration <= 3; iteration += 1) {
      const { page, context } = await newPage();
      const row = { label, iteration };
      await page.goto(server.origin, { waitUntil: "domcontentloaded" });
      row.coldReadyMs = await ready(page, "HOME_TOP");
      // Equal observation window: candidate can prepare other pages; baseline cannot.
      await page.waitForTimeout(5000);
      row.watchNavigationMs = await navigate(page, "/watch", "WATCH_TOP");
      row.homeNavigationMs = await navigate(page, "/", "HOME_TOP");
      // Exceed the unchanged 15-second metadata TTL in both builds.
      await page.waitForTimeout(16_000);
      row.watchAfterMetadataTtlMs = await navigate(page, "/watch", "WATCH_TOP");
      row.lab = await page.evaluate(() => window.bannerLab);
      await page.screenshot({
        path: resolve(out, `${label}-${iteration}-watch.png`),
        fullPage: true,
      });
      assert.deepEqual(row.lab.errors, [], "Uncaught browser errors");
      report.runs.push(row);
      await context.close();
    }
    if (label === "candidate") {
      for (const width of [320, 360, 375, 390, 393, 412, 430, 768, 1280]) {
        const { page, context } = await newPage(width);
        await page.goto(server.origin);
        await ready(page, "HOME_TOP");
        const geometry = await page.evaluate(() => {
          const banner = document.querySelector('[data-placement="HOME_TOP"]');
          const image = banner.querySelector('img:not([aria-hidden="true"])');
          const b = banner.getBoundingClientRect();
          const i = image.getBoundingClientRect();
          return {
            viewport: innerWidth,
            documentWidth: document.documentElement.scrollWidth,
            bannerWidth: b.width,
            imageWidth: i.width,
            imageHeight: i.height,
            objectFit: getComputedStyle(image).objectFit,
          };
        });
        assert(geometry.documentWidth <= width + 1, `Horizontal overflow at ${width}`);
        assert(
          Math.abs(geometry.imageWidth / geometry.imageHeight - 720 / 300) < 0.02,
          `Artwork ratio at ${width}`,
        );
        report.widths.push({ width, ...geometry });
        await page.screenshot({
          path: resolve(out, `candidate-home-${width}.png`),
          fullPage: true,
        });
        await context.close();
      }
      const { page, context } = await newPage();
      await page.goto(server.origin);
      await ready(page, "HOME_TOP");
      server.state.version = 1;
      await page.waitForTimeout(16_000);
      await navigate(page, "/watch", "WATCH_TOP");
      await page.locator('nav[aria-label="Primary"] a[href="/"]').click();
      await page
        .locator(
          '[data-placement="HOME_TOP"][data-state="ready"] img[alt="Browser fixture 1"]:not([aria-hidden="true"])',
        )
        .waitFor({ state: "visible" });
      report.replacementObserved = true;
      server.state.enabled = false;
      await page.waitForTimeout(16_000);
      await navigate(page, "/watch", "WATCH_TOP");
      const disabledRead = page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/public/v1/banners/HOME_TOP",
      );
      await page.locator('nav[aria-label="Primary"] a[href="/"]').click();
      assert.equal((await (await disabledRead).json()).enabled, false);
      await page.evaluate(
        () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
      );
      await page.waitForFunction(
        () => !document.querySelector('[data-placement="HOME_TOP"][data-state="ready"]'),
      );
      report.disabledObserved = true;
      await page.screenshot({ path: resolve(out, "candidate-disabled.png"), fullPage: true });
      await context.close();
    }
    report[`${label}Requests`] = server.state.requests;
    report[`${label}UnexpectedApiRequests`] = [...new Set(server.state.unexpected)];
    assert.deepEqual(
      report[`${label}UnexpectedApiRequests`],
      [],
      "Missing API fixtures or unexpected writes",
    );
  }
  report.status = "PASS — controlled browser lab only";
} catch (error) {
  report.status = "FAIL";
  report.error = error.stack;
  throw error;
} finally {
  await writeFile(resolve(out, "results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  await Promise.all(servers.map((server) => server.close()));
}
