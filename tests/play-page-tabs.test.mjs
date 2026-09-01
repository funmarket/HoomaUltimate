import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Play presents Players and Open matches as sibling local views", async () => {
  const [page, css, router] = await Promise.all([
    read("packages/frontend/src/events/PlayPage.tsx"),
    read("packages/frontend/src/events/play.css"),
    read("apps/web/src/app/router/HoomaRouter.tsx"),
  ]);

  assert.match(page, /type PlayView = "players" \| "open-matches";/);
  assert.match(page, /useState<PlayView>\("players"\)/);
  assert.match(page, /className="play-view-tabs" role="tablist" aria-label="Play sections"/);
  assert.match(page, />\s*Players\s*<\/button>/);
  assert.match(page, />\s*Open matches\s*<\/button>/);
  assert.match(page, /aria-selected=\{activeView === "players"\}/);
  assert.match(page, /aria-selected=\{activeView === "open-matches"\}/);
  assert.match(
    page,
    /\{activeView === "players" \? \(\s*<section className="play-section" aria-labelledby="players-looking-title">/s,
  );
  assert.match(
    page,
    /\{activeView === "open-matches" \? \(\s*<section className="play-section" aria-labelledby="open-matches-title">/s,
  );
  assert.doesNotMatch(page, /hidden=\{activeView/);
  assert.match(
    css,
    /\.play-view-tabs\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s,
  );
  assert.match(css, /\.play-view-tab\.is-active\s*\{/);
  assert.match(router, /path="\/play" element=\{<PlayPage \/>\}/);
  assert.doesNotMatch(router, /path="\/play\/(?:players|open-matches)"/);
});

test("Play detail and Open Matches use the authenticated Play API authority", async () => {
  const [detailPage, eventApi, playApi, rideDestinationFields] = await Promise.all([
    read("packages/frontend/src/events/EventDetailPage.tsx"),
    read("packages/frontend/src/events/api.ts"),
    read("packages/frontend/src/events/play-api.ts"),
    read("packages/frontend/src/rides/RideDestinationFields.tsx"),
  ]);

  assert.match(
    detailPage,
    /setEvent\(await eventApi\.publicDetail\(eventId\)\);[\s\S]*setEvent\(await playApi\.matchDetail\(eventId\)\);/,
  );
  assert.match(detailPage, /reason instanceof HoomaApiError && reason\.status === 401/);
  assert.doesNotMatch(eventApi, /publicPlay/);
  assert.match(playApi, /openMatches: \(query: OpenPlayMatchQuery = \{\}\)/);
  assert.match(playApi, /\/api\/v1\/play\/open-matches/);
  assert.match(playApi, /cursor/);
  assert.match(playApi, /matchDetail: \(eventId: string\)/);
  assert.match(playApi, /\/api\/v1\/play\/matches\/\$\{encodeURIComponent\(eventId\)\}/);
  assert.match(
    rideDestinationFields,
    /Promise\.all\(\[playApi\.openMatches\(\), eventApi\.publicWatch\(\)\]\)/,
  );
  assert.doesNotMatch(rideDestinationFields, /eventApi\.publicPlay/);
});

test("Play match forms keep visibility explicit and nested actions softly styled", async () => {
  const [createPage, editPage, visibilityField, visibilityCss, locationPicker, locationCss, webCss] =
    await Promise.all([
      read("packages/frontend/src/events/CreateEventPage.tsx"),
      read("packages/frontend/src/events/EditEventPage.tsx"),
      read("packages/frontend/src/events/PlayVisibilityField.tsx"),
      read("packages/frontend/src/events/play-visibility.css"),
      read("packages/frontend/src/game-location/GameLocationPicker.tsx"),
      read("packages/frontend/src/game-location/game-location.css"),
      read("apps/web/src/styles.css"),
    ]);

  assert.match(createPage, /<PlayVisibilityField \/>/);
  assert.match(editPage, /<PlayVisibilityField/);
  assert.match(createPage, /className="event-form__primary-action"/);
  assert.match(editPage, /className="event-form__primary-action"/);
  assert.match(visibilityField, /value="OPEN"/);
  assert.match(visibilityField, /value="PRIVATE"/);
  assert.match(visibilityField, />\s*Public\s*</);
  assert.match(visibilityField, />\s*Private\s*</);
  assert.match(
    visibilityCss,
    /background: color-mix\(in srgb, var\(--app-lime\) 9%, transparent\);/,
  );
  assert.match(
    visibilityCss,
    /background: color-mix\(in srgb, var\(--app-gold\) 8%, transparent\);/,
  );
  assert.match(locationPicker, />\s*HOOMA Pitch\s*<\/button>/);
  assert.match(locationPicker, />\s*Other location\s*<\/button>/);
  assert.match(
    locationCss,
    /\.game-location-picker__choices button\.is-active\s*\{[^}]*background: color-mix\([^;]*11%, transparent\);/s,
  );
  assert.doesNotMatch(locationCss, /button\.is-active\s*\{[^}]*background:\s*var\(/s);
  assert.doesNotMatch(webCss, /\.event-form button,/);
  assert.match(webCss, /\.event-form__primary-action,/);
  assert.match(
    webCss,
    /background: color-mix\(in srgb, var\(--app-lime\) 8%, transparent\);/,
  );
});
