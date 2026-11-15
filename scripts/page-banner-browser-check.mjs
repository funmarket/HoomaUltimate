// Browser lab only: compiled application, identical immutable WebP bytes, shared artwork bandwidth.
// No live backend, credentials, Admin writes, or production performance claims.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
// Seeded noise prevents solid-color compression from making bandwidth contention invisible.
const images = await Promise.all(
  [1, 2].map(async (seed) => {
    const pixels = Buffer.alloc(720 * 300 * 3);
    let value = seed;
    for (let i = 0; i < pixels.length; i += 1) {
      value ^= value << 13;
      value ^= value >>> 17;
      value ^= value << 5;
      pixels[i] = value & 255;
    }
    return sharp(pixels, { raw: { width: 720, height: 300, channels: 3 } })
      .webp({ quality: 75 })
      .toBuffer();
  }),
);
const sharedArtworkBytesPerSecond = 200_000;
// One aggregate budget, divided round-robin across concurrent artwork responses.
// This is a controlled transport experiment, not a mobile-network or production claim.
function artworkTransport() {
  const pending = [];
  const intervalMs = 20;
  let timer;
  function drain() {
    const live = pending.filter((item) => !item.res.destroyed);
    pending.length = 0;
    pending.push(...live);
    const allowance = Math.floor(
      (sharedArtworkBytesPerSecond * intervalMs) / 1000 / Math.max(1, pending.length),
    );
    for (const item of [...pending]) {
      const end = Math.min(item.offset + allowance, item.bytes.length);
      item.res.write(item.bytes.subarray(item.offset, end));
      item.offset = end;
      if (end === item.bytes.length) {
        item.res.end();
        pending.splice(pending.indexOf(item), 1);
      }
    }
    if (!pending.length) {
      clearInterval(timer);
      timer = undefined;
    }
  }
  return {
    send(res, bytes, constrained) {
      if (!constrained) {
        res.end(bytes);
        return;
      }
      pending.push({ res, bytes, offset: 0 });
      timer ??= setInterval(drain, intervalMs);
    },
    close() {
      clearInterval(timer);
      for (const item of pending) item.res.destroy();
    },
  };
}
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
  transport: {
    sharedArtworkBytesPerSecond,
    intervalMs: 20,
    metadataDelayMs: 0,
    scope:
      "One aggregate artwork budget per isolated server; other application resources unlimited",
  },
  fixtures: images.map((bytes) => ({
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: 720,
    height: 300,
    type: "image/webp",
  })),
  runs: [],
  widths: [],
};

async function serve(directory) {
  const root = resolve(directory);
  const transport = artworkTransport();
  const state = {
    enabled: true,
    version: 0,
    sequence: 0,
    requests: [],
    unexpected: [],
    constrained: false,
  };
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
                      variant: "mobile",
                      delivery: "IMMUTABLE",
                      contentUrl: `/fixture/${placementId}/${version}.webp`,
                      expiresAt: null,
                      contentType: "image/webp",
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
        res.writeHead(200, {
          "content-type": "image/webp",
          "content-length": images[Number(url.pathname.split("/").at(-1).split(".")[0])].length,
          "cache-control": "public, max-age=31536000, immutable",
        });
        return transport.send(
          res,
          images[Number(url.pathname.split("/").at(-1).split(".")[0])],
          state.constrained,
        );
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
    close: () => {
      transport.close();
      return new Promise((done) => server.close(done));
    },
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
    window.bannerLab = { observations: [], shifts: [], errors: [], decodes: [] };
    const decode = HTMLImageElement.prototype.decode;
    HTMLImageElement.prototype.decode = async function () {
      const startedAt = performance.now();
      await decode.call(this);
      window.bannerLab.decodes.push({
        url: this.currentSrc || this.src,
        startedAt,
        finishedAt: performance.now(),
        connected: this.isConnected,
      });
    };
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
    .waitFor({ state: "visible", timeout: 30_000 });
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

async function capture(page) {
  return page.evaluate(() => ({
    ...window.bannerLab,
    resources: performance
      .getEntriesByType("resource")
      .filter((entry) => /\/fixture\/|\/api\/public\/v1\/banners\//.test(entry.name))
      .map((entry) => ({
        url: entry.name,
        startTime: entry.startTime,
        requestStart: entry.requestStart,
        responseStart: entry.responseStart,
        responseEnd: entry.responseEnd,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
      })),
  }));
}
function assertActiveFirst(row) {
  const unrelated = row.lab.resources.filter((entry) => {
    const path = new URL(entry.url).pathname;
    return !path.includes("HOME_TOP") && entry.startTime < row.coldReadyMs;
  });
  assert.deepEqual(
    unrelated,
    [],
    "Unrelated banner request started before mounted active visibility",
  );
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
      const row = { label, iteration, scenario: "unconstrained" };
      await page.goto(server.origin, { waitUntil: "domcontentloaded" });
      row.coldReadyMs = await ready(page, "HOME_TOP");
      // Equal observation window for the unchanged serial preparation pass in both builds.
      await page.waitForTimeout(5000);
      row.watchNavigationMs = await navigate(page, "/watch", "WATCH_TOP");
      row.homeNavigationMs = await navigate(page, "/", "HOME_TOP");
      // Exceed the unchanged 15-second metadata TTL in both builds.
      await page.waitForTimeout(16_000);
      row.watchAfterMetadataTtlMs = await navigate(page, "/watch", "WATCH_TOP");
      row.lab = await capture(page);
      if (label === "candidate") assertActiveFirst(row);
      await page.screenshot({
        path: resolve(out, `${label}-${iteration}-watch.png`),
        fullPage: true,
      });
      assert.deepEqual(row.lab.errors, [], "Uncaught browser errors");
      report.runs.push(row);
      await context.close();
    }
    server.state.constrained = true;
    for (let iteration = 1; iteration <= 3; iteration += 1) {
      const { page, context } = await newPage();
      const row = { label, iteration, scenario: "shared-artwork-bandwidth" };
      await page.goto(server.origin, { waitUntil: "domcontentloaded" });
      row.coldReadyMs = await ready(page, "HOME_TOP");
      // Wait for completed timing records, not as a substitute for active readiness.
      await page.waitForFunction(
        () =>
          new Set(
            performance
              .getEntriesByType("resource")
              .filter((entry) => new URL(entry.name).pathname.startsWith("/fixture/"))
              .map((entry) => entry.name),
          ).size === 11,
        undefined,
        { timeout: 30_000 },
      );
      row.lab = await capture(page);
      if (label === "candidate") assertActiveFirst(row);
      assert.deepEqual(row.lab.errors, []);
      report.runs.push(row);
      await context.close();
    }
    server.state.constrained = false;
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
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  report.coldComparison = Object.fromEntries(
    ["unconstrained", "shared-artwork-bandwidth"].map((scenario) => {
      const baseline = median(
        report.runs
          .filter((row) => row.label === "baseline" && row.scenario === scenario)
          .map((row) => row.coldReadyMs),
      );
      const candidate = median(
        report.runs
          .filter((row) => row.label === "candidate" && row.scenario === scenario)
          .map((row) => row.coldReadyMs),
      );
      return [
        scenario,
        {
          baselineMedianMs: baseline,
          candidateMedianMs: candidate,
          changePercent: (100 * (candidate - baseline)) / baseline,
        },
      ];
    }),
  );
  assert(
    report.coldComparison["shared-artwork-bandwidth"].candidateMedianMs <
      report.coldComparison["shared-artwork-bandwidth"].baselineMedianMs,
    "Shared-bandwidth lab did not demonstrate a cold-entry improvement",
  );
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
