import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Gamer challenger cards keep one HUD presentation with direct actions", async () => {
  const [page, css, router, index] = await Promise.all([
    read("packages/frontend/src/gamers/GamerGamePage.tsx"),
    read("packages/frontend/src/gamers/gamers.css"),
    read("apps/web/src/app/router/HoomaRouter.tsx"),
    read("packages/frontend/src/index.ts"),
  ]);

  const cardStart = page.indexOf('<article className="gamer-challenger-card"');
  const cardEnd = page.indexOf("</article>", cardStart);
  assert.notEqual(cardStart, -1);
  assert.notEqual(cardEnd, -1);
  const card = page.slice(cardStart, cardEnd);

  assert.match(card, /gamer-card-hud-rail/);
  assert.match(card, /PLAYER PROFILE/);
  assert.match(card, /gamer-card-portrait-panel/);
  assert.match(card, /gamer-card-game-label">GAME · \{game\.name\}<\/span>/);
  assert.match(card, /gamer-card-handle-block/);
  assert.match(card, /<span>GAMER TAG<\/span>/);
  assert.match(card, /gamer-handle">\{challenger\.handle\}<\/p>/);
  assert.match(card, /gamer-card-identity-block/);
  assert.match(card, /<span>HOOMA ID<\/span>/);
  assert.match(card, /<h3>\{challenger\.presentation\.displayName\}<\/h3>/);
  assert.ok(card.indexOf("challenger.handle") < card.indexOf("presentation.displayName}</h3>"));
  assert.match(card, /<span className="gamer-open-badge">OPEN TO CHALLENGE<\/span>/);
  assert.match(card, /gamer-card-signal/);
  assert.match(card, /className=\{`gamer-whistle-button/);
  assert.match(card, />\s*WHISTLE\s*<\/button>/);
  assert.match(card, /<button\s+className="button gamer-challenge-button"/);
  assert.match(card, /<GamerWhistlePanel/);
  assert.doesNotMatch(card, /OPEN PROFILE/);
  assert.doesNotMatch(card, /gamer-card-profile-link/);
  assert.doesNotMatch(card, /\/profiles\//);
  assert.doesNotMatch(
    card,
    /\b(?:ONLINE|LEVEL|XP|CLASS|RANK|eFootball|PES|FC Mobile|Ludo|football)\b/i,
  );

  assert.match(css, /--gamers-cyan:\s*#31d7ff/);
  assert.match(css, /--gamers-violet:\s*#b251ff/);
  assert.match(css, /\.gamer-card-hud-rail\s*\{/);
  assert.match(css, /\.gamer-card-portrait-panel\s*\{/);
  assert.match(css, /\.gamer-card-profile-content\s*\{[^}]*min-height:\s*280px/s);
  assert.match(
    css,
    /\.gamer-card-profile-content\s*\{[^}]*grid-template-columns:\s*minmax\(148px, 0\.82fr\) minmax\(0, 1\.18fr\)/s,
  );
  assert.match(css, /\.gamer-card-handle-block\s*\{/);
  assert.match(css, /\.gamer-card-identity-block\s*\{/);
  assert.match(css, /\.gamer-card-signal\s*\{/);
  assert.match(css, /\.gamer-card-actions\s*\{/);
  assert.match(css, /\.gamer-whistle-button\s*\{/);
  assert.match(css, /\.gamer-whistle-panel\s*\{/);
  assert.match(css, /\.gamers-page \.gamer-challenge-button\s*\{/);
  assert.match(css, /@media \(max-width: 500px\)/);
  assert.match(css, /\.gamer-avatar\s*\{[^}]*aspect-ratio:\s*1\.58/s);
  assert.doesNotMatch(css, /\.gamer-profile-showcase\s*\{/);
  assert.doesNotMatch(css, /\.gamer-profile-main\s*\{/);

  assert.doesNotMatch(router, /GamerProfilePage/);
  assert.doesNotMatch(router, /\/gamers\/games\/:gameSlug\/profiles\/:profileId/);
  assert.doesNotMatch(index, /GamerProfilePage/);
});

test("Direct Gamer Whistle stays on the shared Whistle engine with server-derived pair authorization", async () => {
  const [gamerService, whistleService, whistleRoutes, whistleRepository, schema, migration, client] =
    await Promise.all([
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
