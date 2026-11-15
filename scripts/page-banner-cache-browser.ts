// Integration browser proof against the real API/PostgreSQL and local-memory object storage.
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import express from "express";
import { pageBannerHttpFixture } from "../tests/helpers/page-banner-http.ts";

const { chromium } = await import(pathToFileURL(process.env.BANNER_PLAYWRIGHT_MODULE!).href);
const output = resolve(process.env.BANNER_EVIDENCE_DIR ?? "../banner-cache-browser-evidence");
await mkdir(output, { recursive: true });
const profile = await mkdtemp(resolve(tmpdir(), "hooma-banner-cache-"));
const f = await pageBannerHttpFixture();
const root = resolve("apps/web/dist");
f.app.use(express.static(root));
f.app.use((_request, response) => response.sendFile(resolve(root, "index.html")));
const report: Record<string, unknown> = {
  environment:
    "Real compiled Web + API + PostgreSQL + Redis; memory object storage; Chromium persistent profile",
  revision: process.env.BANNER_HEAD_SHA,
  observations: [],
  requests: [],
};
let crossServer: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
async function launch() {
  context = await chromium.launchPersistentContext(profile, {
    headless: true,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => {
    report.errors ??= [] as string[];
    (report.errors as string[]).push(error.message);
  });
  page.on("response", async (response) => {
    if (response.url().includes("/artwork/"))
      (report.requests as unknown[]).push({
        path: new URL(response.url()).pathname,
        status: response.status(),
        fromServiceWorker: response.fromServiceWorker(),
      });
  });
  return page;
}
async function ready(page: Awaited<ReturnType<typeof launch>>, label: string) {
  await page
    .locator('[data-placement="HOME_TOP"][data-state="ready"]')
    .waitFor({ state: "visible" });
  const image = page.locator('[data-placement="HOME_TOP"] img:not([aria-hidden="true"])');
  await page.waitForFunction(() => {
    const image = document.querySelector<HTMLImageElement>(
      '[data-placement="HOME_TOP"] img:not([aria-hidden="true"])',
    );
    return image?.complete && image.naturalWidth > 0;
  });
  await page.screenshot({ path: resolve(output, `${label}.png`), fullPage: true });
  return image.getAttribute("src");
}
try {
  const first = await f.upload("#213f60");
  let page = await launch();
  await page.goto(f.origin);
  const firstUrl = await ready(page, "first-load");
  const initialReads = f.reads.length;
  assert(initialReads > 0);
  await page.reload();
  assert.equal(await ready(page, "warm-reload"), firstUrl);
  assert.equal(f.reads.length, initialReads, "Warm reload must not read artwork at origin");
  report.warmReloadOriginReads = f.reads.length - initialReads;
  await context!.close();
  page = await launch();
  await page.goto(f.origin);
  assert.equal(await ready(page, "browser-restart"), firstUrl);
  assert.equal(f.reads.length, initialReads, "New Chromium process must reuse disk-cached artwork");
  report.browserRestartOriginReads = f.reads.length - initialReads;
  const second = await f.upload("#a53f30", first.id);
  assert.notEqual(second.mediaId, first.mediaId);
  await page.reload();
  const secondUrl = await ready(page, "replacement");
  assert.notEqual(secondUrl, firstUrl);
  assert(f.reads.length > initialReads, "Replacement bytes must reach the origin");
  report.replacementOriginReads = f.reads.length - initialReads;
  report.versionChanged = true;
  const crossApp = express();
  crossApp.get("/", (_request, response) =>
    response
      .type("html")
      .send(
        `<img alt="Cross origin banner" src="${secondUrl!.startsWith("http") ? secondUrl : f.origin + secondUrl}">`,
      ),
  );
  crossServer = crossApp.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => crossServer!.once("listening", resolve));
  const crossAddress = crossServer.address();
  assert(crossAddress && typeof crossAddress === "object");
  const crossPage = await context!.newPage();
  await crossPage.goto(`http://127.0.0.1:${crossAddress.port}`);
  await crossPage.waitForFunction(() => {
    const image = document.querySelector("img");
    return image?.complete && image.naturalWidth > 0;
  });
  report.crossOriginEmbedding = true;
  await crossPage.close();

  assert.equal((await fetch(f.origin + new URL(firstUrl!, f.origin).pathname)).status, 404);
  await f.enabled(false);
  const disabledResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/public/v1/banners/HOME_TOP") && response.status() === 200,
  );
  await page.reload();
  assert.deepEqual((await (await disabledResponse).json()).slides, []);
  await page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );
  await page.waitForFunction(
    () => !document.querySelector('[data-placement="HOME_TOP"][data-state="ready"]'),
  );
  await page.screenshot({ path: resolve(output, "disabled.png"), fullPage: true });
  report.disabled = true;
  await f.enabled(true);
  await f.remove(first.id);
  await page.reload();
  // A completed network-idle interval plus metadata read-back prevents accepting only the loading state.
  await page.waitForLoadState("networkidle");
  assert.deepEqual((await f.metadata()).slides, []);
  assert.equal(await page.locator('[data-placement="HOME_TOP"][data-state="ready"]').count(), 0);
  assert.equal((await fetch(f.origin + new URL(secondUrl!, f.origin).pathname)).status, 404);
  report.deleted = true;
  assert.deepEqual(report.errors ?? [], []);
  report.status = "PASS";
} catch (error) {
  report.status = "FAIL";
  report.error = String(error);
  throw error;
} finally {
  await writeFile(resolve(output, "results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await context?.close();
  if (crossServer) await new Promise<void>((resolve) => crossServer!.close(() => resolve()));
  await f.close();
  await rm(profile, { recursive: true, force: true });
}
