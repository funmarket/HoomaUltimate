import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Gamer challenger cards use the neutral HUD identity composition", async () => {
  const [page, css] = await Promise.all([
    read("packages/frontend/src/gamers/GamerGamePage.tsx"),
    read("packages/frontend/src/gamers/gamers.css"),
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
  assert.match(card, /<button\s+className="button gamer-challenge-button"/);
  assert.match(card, /<\/a>\s+\{!isOwn \? \(/);
  assert.doesNotMatch(card, /ONLINE|LEVEL|XP|CLASS|RANK|eFootball|PES|FC Mobile|Ludo|football/i);

  assert.match(css, /--gamers-cyan:\s*#31d7ff/);
  assert.match(css, /--gamers-violet:\s*#b251ff/);
  assert.match(css, /\.gamer-card-hud-rail\s*\{/);
  assert.match(css, /\.gamer-card-portrait-panel\s*\{/);
  assert.match(css, /\.gamer-card-profile-link\s*\{[^}]*min-height:\s*280px/s);
  assert.match(
    css,
    /\.gamer-card-profile-link\s*\{[^}]*grid-template-columns:\s*minmax\(148px, 0\.82fr\) minmax\(0, 1\.18fr\)/s,
  );
  assert.match(css, /\.gamer-card-handle-block\s*\{/);
  assert.match(css, /\.gamer-card-identity-block\s*\{/);
  assert.match(css, /\.gamer-card-signal\s*\{/);
  assert.match(css, /\.gamer-open-badge::before\s*\{/);
  assert.match(css, /\.gamers-page \.gamer-challenge-button\s*\{/);
  assert.match(css, /@media \(max-width: 500px\)/);
  assert.match(css, /\.gamer-avatar\s*\{[^}]*aspect-ratio:\s*1\.58/s);
  assert.doesNotMatch(
    css,
    /\.gamer-card-profile-link\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s,
  );
});
