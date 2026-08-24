import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Play player cards route to the canonical public profile and keep intent-specific CTAs", async () => {
  const [card, page, css, router, identityRoutes] = await Promise.all([
    read("packages/frontend/src/events/PlayPlayerCard.tsx"),
    read("packages/frontend/src/events/PlayPage.tsx"),
    read("packages/frontend/src/events/play-player-listing.css"),
    read("apps/web/src/app/router/HoomaRouter.tsx"),
    read("apps/api/src/http/public-v1/router.ts"),
  ]);

  assert.match(
    card,
    /profileHref = `\/profile\/\$\{encodeURIComponent\(presentation\.username\)\}`/,
  );
  assert.match(card, /<strong>INVITE<\/strong>/);
  assert.match(card, /\{offerSent \? "OFFER SENT" : "HIRE PLAYER"\}/);
  assert.match(card, /onClick=\{\(\) => onHire\?\.\(listing\)\}/);
  assert.match(card, /aria-disabled="true"/);
  assert.match(page, /<PlayPlayerCard listing=\{listing\}/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(router, /path="\/profile\/:username"/);
  assert.match(identityRoutes, /router\.use\("\/profiles", createIdentityProfilePublicRouter/);
});
