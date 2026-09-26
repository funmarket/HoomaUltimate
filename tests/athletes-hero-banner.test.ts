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

  assert.match(hub, /onClick=\{onCreateCommunity\}/);
  assert.match(hub, />\s*Create community\s*<\/button>/);
  assert.match(
    hub,
    /<h1 className="athletes-hero__semantic-title">\s*Move together\. Train together\.\s*<\/h1>/,
  );
  assert.doesNotMatch(hub, /<span className="eyebrow">ATHLETES<\/span>/);
  assert.doesNotMatch(hub, /Find local sports communities built around the way you move\./);
  assert.match(hub, /className="athletes-hero__banner"/);
  assert.match(hub, /src=\{heroUrl\}/);
  assert.match(hub, /api\.athletes[\s\S]*?\.heroDelivery\(controller\.signal\)/);
});

test("Athletes hub banner is phone-scaled, borderless, and keeps only semantic hidden copy", () => {
  const hubRule =
    athletesCss.match(/\.athletes-hero(?:\.athletes-hero--hub|--hub)\s*\{[\s\S]*?\}/)?.[0] ??
    "";
  const bannerRule =
    athletesCss.match(/\.athletes-hero__banner\s*\{[\s\S]*?\}/)?.[0] ?? "";
  const hiddenRule =
    athletesCss.match(/\.athletes-hero--hub \.athletes-hero__semantic-title\s*\{[\s\S]*?\}/)?.[0] ??
    "";

  assert.match(hubRule, /aspect-ratio:\s*1280\s*\/\s*431/);
  assert.match(hubRule, /min-height:\s*0/);
  assert.match(hubRule, /padding:\s*0/);
  assert.match(hubRule, /border:\s*0/);
  assert.match(hubRule, /box-shadow:\s*none/);
  assert.doesNotMatch(hubRule, /min-height:\s*20rem/);

  assert.match(bannerRule, /width:\s*100%/);
  assert.match(bannerRule, /height:\s*100%/);
  assert.match(bannerRule, /object-fit:\s*contain/);

  assert.match(hiddenRule, /width:\s*1px/);
  assert.match(hiddenRule, /height:\s*1px/);
  assert.match(hiddenRule, /clip:/);
  assert.doesNotMatch(hiddenRule, /display:\s*none|visibility:\s*hidden/);

  assert.match(athletesCss, /\.athletes-hero--hub::before[\s\S]*display:\s*none/);
  assert.match(athletesCss, /\.athletes-hero--hub::after[\s\S]*display:\s*none/);
  assert.match(athletesCss, /\.athletes-hero--hub \.athletes-hero__motion[\s\S]*display:\s*none/);
  assert.match(athletesCss, /\.athletes-hero--create h1/);
  assert.match(athletesCss, /\.athletes-hero--detail h1/);
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
