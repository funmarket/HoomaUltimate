import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Gamer challenger cards stay game-neutral and preserve profile/action separation", async () => {
  const [page, css] = await Promise.all([
    read("packages/frontend/src/gamers/GamerGamePage.tsx"),
    read("packages/frontend/src/gamers/gamers.css"),
  ]);

  assert.match(page, /<article className="gamer-challenger-card"/);
  assert.match(page, /className="gamer-card-profile-link"/);
  assert.match(page, /<p className="gamer-handle">\{challenger\.handle\}<\/p>/);
  assert.match(page, /<span className="gamer-open-badge">OPEN TO CHALLENGE<\/span>/);
  assert.match(page, /<button\s+className="button gamer-challenge-button"/);
  assert.match(page, /<\/a>\s+\{!isOwn \? \(/);

  assert.match(css, /\.gamer-card-profile-link\s*\{[^}]*min-height:\s*238px/s);
  assert.match(
    css,
    /\.gamer-card-profile-link\s*\{[^}]*grid-template-columns:\s*minmax\(132px, 0\.78fr\) minmax\(0, 1fr\)/s,
  );
  assert.match(css, /\.gamer-avatar\s*\{[^}]*min-height:\s*238px/s);
  assert.match(css, /\.gamer-open-badge::before\s*\{/);
  assert.match(css, /\.gamers-page \.gamer-challenge-button\s*\{/);
  assert.match(css, /@media \(max-width: 430px\)/);
  assert.match(css, /\.gamer-avatar\s*\{[^}]*aspect-ratio:\s*1\.55/s);

  assert.doesNotMatch(
    css,
    /\b(?:efootball|pes|fifa|football|soccer|pitch|stadium)\b/i,
    "Challenger card presentation must not hardcode one game or genre",
  );
  assert.doesNotMatch(
    css,
    /\.gamer-card-profile-link\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s,
  );
});
