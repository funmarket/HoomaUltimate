import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Play player cards route to the canonical profile and use real React-owned actions", async () => {
  const [card, page, api, css, router, identityRoutes] = await Promise.all([
    read("packages/frontend/src/events/PlayPlayerCard.tsx"),
    read("packages/frontend/src/events/PlayPage.tsx"),
    read("packages/frontend/src/events/play-api.ts"),
    read("packages/frontend/src/events/play-player-listing.css"),
    read("apps/web/src/app/router/HoomaRouter.tsx"),
    read("apps/api/src/http/public-v1/router.ts"),
  ]);

  assert.match(
    card,
    /profileHref = `\/profile\/\$\{encodeURIComponent\(presentation\.username\)\}`/,
  );
  assert.match(card, /lookingForGame \? onInvite\?\.\(listing\) : onHire\?\.\(listing\)/);
  assert.match(card, /lookingForGame \? "INVITE" : "HIRE PLAYER"/);
  assert.doesNotMatch(card, /aria-disabled="true"/);
  assert.match(card, /disabled=\{actionDisabled\}/);
  assert.match(card, /<\/a>\s+<div className="play-player-card__action-zone">/);
  assert.doesNotMatch(
    css,
    /\.play-player-card__profile-link\s*\{[^}]*position:\s*absolute[^}]*inset:\s*0/s,
  );
  assert.doesNotMatch(css, /\.play-player-card__action-zone\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(page, /onInvite=\{\(candidate\) => void startInvite\(candidate\)\}/);
  assert.match(page, /onHire=\{\(candidate\) => void startHire\(candidate\)\}/);
  assert.match(page, /actionDisabled=\{actionBusy\}/);
  assert.match(page, /playApi\.actionState\(\)/);
  assert.match(page, /playApi\.sendTeamOffer/);
  assert.match(page, /playApi\.sendEventInvite/);
  assert.match(page, /scrollIntoView/);
  assert.doesNotMatch(page, /sentOfferListingIds/);
  assert.match(api, /\/api\/v1\/play\/player-actions/);
  assert.match(api, /\/team-offer`/);
  assert.match(api, /\/event-invite`/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /@media \(max-width: 720px\)/);
  assert.match(router, /path="\/profile\/:username"/);
  assert.match(identityRoutes, /router\.use\("\/profiles", createIdentityProfilePublicRouter/);
});
