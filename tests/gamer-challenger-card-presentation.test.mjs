import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Gamer discovery reuses one HUD card across homepage and game hub", async () => {
  const [card, home, gamePage, css, homeCss, router, index] = await Promise.all([
    read("packages/frontend/src/gamers/GamerHudCard.tsx"),
    read("packages/frontend/src/gamers/GamersPage.tsx"),
    read("packages/frontend/src/gamers/GamerGamePage.tsx"),
    read("packages/frontend/src/gamers/gamers.css"),
    read("packages/frontend/src/gamers/gamers-home.css"),
    read("apps/web/src/app/router/HoomaRouter.tsx"),
    read("packages/frontend/src/index.ts"),
  ]);

  assert.match(card, /<article className="gamer-challenger-card">/);
  assert.match(card, /gamer-card-hud-rail/);
  assert.match(card, /PLAYER PROFILE/);
  assert.match(card, /gamer-card-portrait-panel/);
  assert.match(card, /GAME · \{game\.name\}/);
  assert.match(card, /<span>GAMER TAG<\/span>/);
  assert.match(card, /\{player\.handle\}/);
  assert.match(card, /<span>HOOMA ID<\/span>/);
  assert.match(card, /\{player\.presentation\.displayName\}/);
  assert.match(card, /OPEN TO CHALLENGE/);
  assert.match(card, /NOT OPEN TO CHALLENGE/);
  assert.match(card, /gamer-card-signal/);
  assert.match(card, />\s*WHISTLE\s*<\/button>/);
  assert.match(card, /gamer-challenge-button/);
  assert.match(card, /<GamerWhistlePanel/);
  assert.doesNotMatch(card, /OPEN PROFILE/);
  assert.doesNotMatch(card, /\/profiles\//);

  assert.match(home, /GAMERS/);
  assert.match(home, /CHALLENGERS/);
  assert.match(home, /GAME CATALOG/);
  assert.match(home, /gamersApi\.discovery\(\)/);
  assert.match(home, /<GamerHudCard/);
  assert.match(home, /<GamerChallengeSetupModal/);
  assert.match(home, /Join Gamers with your existing HOOMA profile/);
  assert.match(home, /onboardingApi\.joinGamers\(\)/);
  assert.doesNotMatch(home, /gamers\.map\([\s\S]*<article className="gamer-challenger-card"/);

  assert.match(gamePage, /<GamerHudCard/);
  assert.match(gamePage, /<GamerChallengeSetupModal/);
  assert.doesNotMatch(gamePage, /<article className="gamer-challenger-card"/);
  assert.doesNotMatch(gamePage, /gamerOptInProfileInput/);

  assert.match(css, /--gamers-cyan:\s*#31d7ff/);
  assert.match(css, /--gamers-violet:\s*#b251ff/);
  assert.match(css, /\.gamer-card-hud-rail\s*\{/);
  assert.match(css, /\.gamer-card-portrait-panel\s*\{/);
  assert.match(css, /\.gamer-card-actions\s*\{/);
  assert.match(homeCss, /\.gamers-home-tabs\s*\{/);
  assert.match(homeCss, /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(homeCss, /\.gamer-modal-backdrop\s*\{/);
  assert.match(homeCss, /\.gamer-setup-modal\s*\{/);
  assert.match(homeCss, /@media \(max-width: 500px\)/);

  assert.doesNotMatch(router, /GamerProfilePage/);
  assert.doesNotMatch(router, /\/gamers\/games\/:gameSlug\/profiles\/:profileId/);
  assert.doesNotMatch(index, /GamerProfilePage/);
});

test("Gamer enrollment is additive and global discovery is canonical", async () => {
  const [
    identityRoute,
    identityService,
    identityRepository,
    identityPrisma,
    gamerRoutes,
    gamerService,
    gamerRepository,
    gamerPrisma,
    onboarding,
  ] = await Promise.all([
    read("apps/api/src/modules/identity/http/identity.member.routes.ts"),
    read("apps/api/src/modules/identity/application/identity.service.ts"),
    read("apps/api/src/modules/identity/application/identity.repository.ts"),
    read("apps/api/src/modules/identity/infrastructure/prisma-identity.repository.ts"),
    read("apps/api/src/modules/gamers/http/gamer.routes.ts"),
    read("apps/api/src/modules/gamers/application/gamer.service.ts"),
    read("apps/api/src/modules/gamers/application/gamer-profile.repository.ts"),
    read("apps/api/src/modules/gamers/infrastructure/prisma-gamer-profile.repository.ts"),
    read("packages/frontend/src/gamers/onboarding.ts"),
  ]);

  assert.match(identityRoute, /\/me\/profile\/identities\/gamer/);
  assert.match(identityService, /enableProfileIdentity/);
  assert.match(identityRepository, /addProfileIdentity/);
  assert.match(identityPrisma, /array_append\("identities"/);
  assert.match(identityPrisma, /ANY\("identities"\)/);
  assert.match(onboarding, /joinGamers/);
  assert.doesNotMatch(onboarding, /updateProfile/);
  assert.doesNotMatch(onboarding, /gamerOptInProfileInput/);

  assert.match(gamerRoutes, /"\/discovery"/);
  assert.doesNotMatch(gamerRoutes, /\/profiles\/:profileId/);
  assert.match(gamerService, /listDiscoverableGamers/);
  assert.doesNotMatch(gamerService, /getPublicProfile/);
  assert.match(gamerRepository, /listDiscoverable/);
  assert.doesNotMatch(gamerRepository, /getPublicByGameAndId/);
  assert.match(gamerPrisma, /game:\s*\{ status: "ACTIVE" \}/);
  assert.match(gamerPrisma, /identities:\s*\{ has: "GAMER" \}/);
});

test("Direct Gamer Whistle stays on the shared Whistle engine with server-derived pair authorization", async () => {
  const [
    gamerService,
    whistleService,
    whistleRoutes,
    whistleRepository,
    schema,
    migration,
    client,
  ] = await Promise.all([
    read("apps/api/src/modules/gamers/application/gamer.service.ts"),
    read("apps/api/src/modules/whistle/application/whistle.service.ts"),
    read("apps/api/src/modules/whistle/http/whistle.routes.ts"),
    read("apps/api/src/modules/whistle/application/whistle.repository.ts"),
    read("packages/database/prisma/schema.prisma"),
    read("packages/database/prisma/migrations/20260825225000_gamer_direct_whistle/migration.sql"),
    read("packages/frontend/src/gamers/gamer-whistle-api.ts"),
  ]);

  assert.match(gamerService, /resolveDirectWhistleContext/);
  assert.match(gamerService, /getByUserAndGame\(userId, otherProfile\.gameId\)/);
  assert.match(gamerService, /GAMER_WHISTLE_SELF_FORBIDDEN/);
  assert.match(gamerService, /hasGamerIdentity\(otherProfile\.userId\)/);
  assert.match(gamerService, /GAMER_WHISTLE_PAIR_CLOSED/);
  assert.match(gamerService, /!ownProfile\.openToChallenge \|\| !otherProfile\.openToChallenge/);
  assert.match(gamerService, /\[ownProfile\.id, otherProfile\.id\]\.sort\(\)\.join\(":"\)/);

  assert.match(whistleService, /listDirectGamer/);
  assert.match(whistleService, /createDirectGamer/);
  assert.match(whistleService, /"GAMER_DIRECT"/);
  assert.match(whistleService, /createAuthorized/);
  assert.match(whistleService, /DAILY_LIMIT = 11/);
  assert.match(whistleService, /graphemes > 33/);
  assert.match(whistleService, /nextUtcMidnight/);

  assert.match(whistleRoutes, /"\/gamers\/:profileId"/);
  assert.doesNotMatch(whistleRoutes, /contextSchema = z\.enum\(\[[^\]]*GAMER_DIRECT/s);
  assert.match(whistleRepository, /"GAMER_DIRECT"/);
  assert.match(schema, /enum WhistleContextType \{[^}]*GAMER_DIRECT/s);
  assert.match(migration, /ADD VALUE IF NOT EXISTS 'GAMER_DIRECT'/);
  assert.match(client, /\/api\/v1\/whistles\/gamers\//);
});
