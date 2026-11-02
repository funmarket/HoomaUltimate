import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type {
  ObjectStorage,
  ObjectStorageReadUrlSigner,
  StoredObject,
  StoredObjectDescriptor,
} from "@hooma/storage";
import { AthletesHeroService } from "../apps/api/src/modules/athletes/application/athletes-hero.service.js";
import { AthletesError } from "../apps/api/src/modules/athletes/domain/athletes-error.js";

const athletesPage = readFileSync("packages/frontend/src/athletes/AthletesPages.tsx", "utf8");
const athletesCss = readFileSync("packages/frontend/src/athletes/athletes.css", "utf8");
const athletesApi = readFileSync("packages/frontend/src/athletes/api.ts", "utf8");
const athletesRoutes = readFileSync(
  "apps/api/src/modules/athletes/http/athletes.routes.ts",
  "utf8",
);
const athletesTabs = readFileSync("packages/frontend/src/athletes/AthletesHubTabs.tsx", "utf8");

class SigningStorage implements ObjectStorage, ObjectStorageReadUrlSigner {
  readonly signedReads: Array<{ key: string; expiresInSeconds: number }> = [];
  readonly gets: string[] = [];
  signError: Error | null = null;

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredObjectDescriptor> {
    return { key, contentType, sizeBytes: body.byteLength };
  }

  async get(key: string): Promise<StoredObject> {
    this.gets.push(key);
    return {
      key,
      contentType: "image/webp",
      sizeBytes: 1,
      body: Uint8Array.of(1),
    };
  }

  async remove(): Promise<void> {}

  async createReadUrl(key: string, expiresInSeconds: number): Promise<string> {
    this.signedReads.push({ key, expiresInSeconds });
    if (this.signError) throw this.signError;
    return `https://storage.example.test/${encodeURIComponent(key)}?signed=1`;
  }
}

function expectAthletesCode(code: string) {
  return (error: unknown) => error instanceof AthletesError && error.code === code;
}

test("Athletes hero signs the exact Railway object key for five minutes without proxying bytes", async () => {
  const storage = new SigningStorage();
  const service = new AthletesHeroService(storage);

  const before = Date.now();
  const delivery = await service.delivery();
  const after = Date.now();

  assert.deepEqual(storage.signedReads, [
    { key: "athletesathletes-hero.webp.webp", expiresInSeconds: 300 },
  ]);
  assert.deepEqual(storage.gets, []);
  assert.match(delivery.contentUrl, /^https:\/\/storage\.example\.test\//);
  const expiresAt = new Date(delivery.expiresAt).getTime();
  assert.ok(expiresAt >= before + 300_000);
  assert.ok(expiresAt <= after + 300_000);
});

test("Athletes hero maps missing or failed storage to safe Athletes errors", async () => {
  await assert.rejects(
    () => new AthletesHeroService(null).delivery(),
    expectAthletesCode("ATHLETES_HERO_STORAGE_NOT_CONFIGURED"),
  );

  const storage = new SigningStorage();
  storage.signError = new Error("railway unavailable");
  await assert.rejects(
    () => new AthletesHeroService(storage).delivery(),
    expectAthletesCode("ATHLETES_HERO_UNAVAILABLE"),
  );
});

test("Athletes hub keeps the real Create community control without visible app copy", () => {
  const hub = athletesPage.slice(
    athletesPage.indexOf("export function AthletesPage"),
    athletesPage.indexOf("export function CreateAthletesPage"),
  );

  assert.ok(hub.includes("onClick={onCreateCommunity}"));
  assert.ok(hub.includes("Create community"));
  assert.ok(hub.includes("page-banner__semantic-title--athletes"));
  assert.ok(hub.includes("Move together. Train together."));
  assert.equal(hub.includes("Find local sports communities built around the way you move."), false);
  assert.ok(hub.includes("page-banner__fallback-image--athletes"));
  assert.ok(hub.includes("src={pageBannerFallbackUrl}"));
  assert.ok(hub.includes(".heroDelivery(controller.signal)"));
});

test("Athletes PageBanner fallback selectors match the final CSS contract", () => {
  const selectors = [
    ".page-banner__fallback--athletes",
    ".page-banner__fallback-image--athletes",
    ".page-banner__semantic-title--athletes",
    ".page-banner__motion--athletes",
  ];

  for (const selector of selectors) {
    assert.ok(athletesCss.includes(selector));
  }

  for (const declaration of [
    "aspect-ratio: 720 / 520;",
    "min-height: 0;",
    "padding: 0;",
    "border: 0;",
    "box-shadow: none;",
    "object-fit: contain;",
    "clip: rect(0 0 0 0);",
    "display: none;",
  ]) {
    assert.ok(athletesCss.includes(declaration));
  }

  assert.equal(athletesCss.includes("athletes-hero--hub"), false);
  assert.ok(athletesCss.includes(".athletes-hero--create h1,"));
  assert.ok(athletesCss.includes(".athletes-hero--detail h1"));
});

test("Athletes hero uses a public signed-delivery endpoint and no local Git-hosted banner path", () => {
  assert.match(athletesRoutes, /router\.get\(\s*"\/hero\/delivery"/);
  assert.match(athletesApi, /\/api\/public\/v1\/athletes\/hero\/delivery/);

  const combined = [athletesPage, athletesCss, athletesApi, athletesRoutes].join("\n");
  assert.doesNotMatch(combined, /\/athletes\/athletes-hero\.webp/);
  assert.doesNotMatch(combined, /\/assets\/athletes-hero\.webp/);
  assert.doesNotMatch(combined, /apps\/web\/public/);
});

test("Athletes section navigation remains Communities, Gear Up, Requests", () => {
  assert.match(athletesTabs, />\s*Communities\s*</);
  assert.match(athletesTabs, />\s*Gear Up\s*</);
  assert.match(athletesTabs, />\s*Requests\s*</);
});
