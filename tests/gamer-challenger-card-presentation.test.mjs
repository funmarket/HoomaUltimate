import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Gamer challenger cards stay game-neutral while using the selected game as context", async () => {
  const [page, css] = await Promise.all([
    read("packages/frontend/src/gamers/GamerGamePage.tsx"),
    read("packages/frontend/src/gamers/gamers.css"),
  ]);

  const cardStart = page.indexOf('<article className="gamer-challenger-card"');
  const cardEnd = page.indexOf("</article>", cardStart);
  assert.notEqual(cardStart, -1);
  assert.notEqual(cardEnd, -1);
  const card = page.slice(cardStart, cardEnd);

  assert.match(card, /gamer-card-game-label">GAME · \{game\.name\}<\/span>/);
  assert.match(card, /gamer-handle">\{challenger\.handle\}<\/p>/);
  assert.match(card, /<h3>\{challenger\.presentation\.displayName\}<\/h3>/);
  assert.ok(card.indexOf("challenger.handle") < card.indexOf("presentation.displayName}</h3>"));
  assert.match(card, /<span className="gamer-open-badge">OPEN TO CHALLENGE<\/span>/);
  assert.match(card, /<button\s+className="button gamer-challenge-button"/);
  assert.match(card, /<\/a>\s+\{!isOwn \? \(/);
  assert.doesNotMatch(card, /eFootball|PES|FC Mobile|Ludo|football/i);

  assert.match(css, /\.gamer-card-profile-link\s*\{[^}]*min-height:\s*238px/s);
  assert.match(
    css,
    /\.gamer-card-profile-link\s*\{[^}]*grid-template-columns:\s*minmax\(132px, 0\.78fr\) minmax\(0, 1fr\)/s,
  );
  assert.match(css, /\.gamer-avatar\s*\{[^}]*min-height:\s*238px/s);
  assert.match(css, /\.gamer-handle\s*\{[^}]*font-size:\s*clamp\(24px, 3vw, 34px\)/s);
  assert.match(css, /\.gamer-card-game-label\s*\{/);
  assert.match(css, /\.gamer-open-badge::before\s*\{/);
  assert.match(css, /\.gamers-page \.gamer-challenge-button\s*\{/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /\.gamer-avatar\s*\{[^}]*aspect-ratio:\s*1\.55/s);
  assert.doesNotMatch(
    css,
    /\.gamer-card-profile-link\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s,
  );
});
