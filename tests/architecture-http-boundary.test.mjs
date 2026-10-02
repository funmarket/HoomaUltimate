import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const architectureCheck = path.resolve("scripts/architecture-check.mjs");

test("architecture check grandfathers exact legacy AppError imports only", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/modules/communities/application/community.service.ts": `
      import { AppError } from "../../../http/errors/app-error.js";
      import { notAllowed } from "../../../http/not-legacy.js";
      export function community() { return [AppError, notAllowed]; }
    `,
  });

  const result = runArchitectureCheck(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /community\.service\.ts: application\/domain layer/);
});

test("architecture check rejects deeper relative application imports into API HTTP", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/modules/rides/application/nested/service.ts": `
      import { AppError } from "../../../../http/errors/app-error.js";
      export function ride() { return AppError; }
    `,
  });

  const result = runArchitectureCheck(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /nested\/service\.ts: application\/domain layer/);
});

test("architecture check keeps exact legacy AppError debt passing", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/modules/communities/application/community.service.ts": `
      import { AppError } from "../../../http/errors/app-error.js";
      export function community() { return AppError; }
    `,
  });

  const result = runArchitectureCheck(root);

  assert.equal(result.status, 0, result.stderr);
});

test("architecture check allows a consumer application to import a foreign application port", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/modules/teams/application/team.service.ts": `
      import type { CommunityCoachAuthorizer } from "../../communities/application/community-coach.authorizer.js";
      export type TeamDependency = CommunityCoachAuthorizer;
    `,
  });

  const result = runArchitectureCheck(root);

  assert.equal(result.status, 0, result.stderr);
});

test("architecture check rejects a consumer application importing foreign infrastructure", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/modules/teams/application/team.service.ts": `
      import { PrismaPlaceRepository } from "../../places/infrastructure/prisma-place.repository.js";
      export const dependency = PrismaPlaceRepository;
    `,
  });

  const result = runArchitectureCheck(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /must not import another domain's infrastructure/);
});

test("architecture check allows the composition root to wire concrete domain infrastructure", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/bootstrap/container.ts": `
      import { PrismaPlaceRepository } from "../modules/places/infrastructure/prisma-place.repository.js";
      export const dependency = PrismaPlaceRepository;
    `,
  });

  const result = runArchitectureCheck(root);

  assert.equal(result.status, 0, result.stderr);
});

const hardenedImports = [
  ["teams/application/team.service.ts", ["../../communities/application/community.service.js"]],
  [
    "events/application/event.service.ts",
    [
      "../../communities/application/community.service.js",
      "../../places/application/place.service.js",
    ],
  ],
  ["pitch/application/pitch-owner.service.ts", ["../../places/application/place.repository.js"]],
  ["gear-up/application/gear-up.service.ts", ["../../places/application/place.repository.js"]],
  [
    "gear-up/application/gear-up-product.service.ts",
    ["../../places/application/place.repository.js"],
  ],
  [
    "gear-up/application/gear-up-product-media.service.ts",
    ["../../places/application/place.repository.js"],
  ],
  [
    "whistle/application/whistle.service.ts",
    [
      "../../communities/application/community.service.js",
      "../../events/application/event.service.js",
      "../../gamers/application/gamer.service.js",
      "../../notifications/application/user-notification.service.js",
      "../../rides/application/ride.service.js",
    ],
  ],
];

for (const [consumer, specifiers] of hardenedImports) {
  for (const specifier of specifiers) {
    test(`architecture check rejects hardened broad import: ${consumer} -> ${specifier}`, async () => {
      const file = `apps/api/src/modules/${consumer}`;
      const root = await createArchitectureFixture({
        [file]: `import type { Dependency } from "${specifier}";`,
      });
      const result = runArchitectureCheck(root);
      assert.notEqual(result.status, 0);
      assert.ok(
        result.stderr.includes(
          `${file}: must use its narrow application capability instead of ${specifier}`,
        ),
        result.stderr,
      );
    });
  }
}

test("architecture check allows every hardened narrow capability and concrete composition", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/modules/teams/application/team.service.ts":
      'import type { CommunityCoachAuthorizer } from "../../communities/application/community-coach.authorizer.js";',
    "apps/api/src/modules/events/application/event.service.ts": `
      import type { CommunityCoachAuthorizer } from "../../communities/application/community-coach.authorizer.js";
      import type { EventPlaceAccess } from "./event-place-access.js";
    `,
    "apps/api/src/modules/pitch/application/pitch-owner.service.ts":
      'import type { PitchPlaceAccess } from "./pitch-place-access.js";',
    ...Object.fromEntries(
      ["gear-up.service.ts", "gear-up-product.service.ts", "gear-up-product-media.service.ts"].map(
        (file) => [
          `apps/api/src/modules/gear-up/application/${file}`,
          'import type { GearUpPlaceAccess } from "./gear-up-place-access.js";',
        ],
      ),
    ),
    "apps/api/src/modules/whistle/application/whistle.service.ts": `
      import type { CommunityMemberAuthorizer } from "../../communities/application/community-member.authorizer.js";
      import type { EventMemberContentAuthorizer } from "../../events/application/event-member-content.authorizer.js";
      import type { GamerDirectWhistleContextResolver } from "../../gamers/application/gamer-direct-whistle-context.resolver.js";
      import type { WhistleNotificationNotifier } from "../../notifications/application/whistle-notification.notifier.js";
      import type { RideWhistleAccessAuthorizer } from "../../rides/application/ride-whistle-access.authorizer.js";
    `,
    "apps/api/src/bootstrap/container.ts": `
      import { CommunityService } from "../modules/communities/application/community.service.js";
      import { PlaceService } from "../modules/places/application/place.service.js";
      import { EventService } from "../modules/events/application/event.service.js";
      import { GamerService } from "../modules/gamers/application/gamer.service.js";
      import { RideService } from "../modules/rides/application/ride.service.js";
      import { UserNotificationService } from "../modules/notifications/application/user-notification.service.js";
    `,
  });
  const result = runArchitectureCheck(root);
  assert.equal(result.status, 0, result.stderr);
});

for (const operation of [
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
]) {
  test(`architecture check rejects Gear Up canonical Place write: ${operation}`, async () => {
    const root = await createArchitectureFixture({
      "apps/api/src/modules/gear-up/infrastructure/prisma-gear-up.repository.ts": `export async function review(tx) { return tx . place . ${operation} ({}); }`,
    });
    const result = runArchitectureCheck(root);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /Gear Up must delegate canonical Place writes to the Places-owned persistence boundary/,
    );
  });
}

test("architecture check allows Gear Up Place reads, relation fields and owner boundary writes", async () => {
  const root = await createArchitectureFixture({
    "apps/api/src/modules/gear-up/infrastructure/prisma-gear-up.repository.ts": `
      import { reviewPendingPlace } from "../../places/boundary/place-moderation.persistence.js";
      export async function review(tx, row) {
        await tx.place.findUnique({});
        await reviewPendingPlace(tx);
        return row.place;
      }
    `,
    "apps/api/src/modules/places/boundary/place-moderation.persistence.ts":
      "export async function reviewPendingPlace(tx) { return tx.place.updateMany({}); }",
  });
  const result = runArchitectureCheck(root);
  assert.equal(result.status, 0, result.stderr);
});

async function createArchitectureFixture(files) {
  const root = await mkdtemp(path.join(tmpdir(), "hooma-architecture-"));
  await writeFixtureFile(
    root,
    "apps/web/src/app/router/HoomaRouter.tsx",
    'export const route = <Route path="/telegram" />;',
  );
  for (const [file, source] of Object.entries(files)) {
    await writeFixtureFile(root, file, source);
  }
  return root;
}

async function writeFixtureFile(root, file, source) {
  const absolute = path.join(root, file);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, source.trimStart(), "utf8");
}

function runArchitectureCheck(root) {
  return spawnSync(process.execPath, [architectureCheck], {
    cwd: root,
    encoding: "utf8",
  });
}
