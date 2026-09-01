import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Play match form keeps mobile actions soft and visibility explicit", async () => {
  const createPage = await read("packages/frontend/src/events/CreateEventPage.tsx");
  const editPage = await read("packages/frontend/src/events/EditEventPage.tsx");
  const visibilityField = await read("packages/frontend/src/events/PlayVisibilityField.tsx");
  const visibilityCss = await read("packages/frontend/src/events/play-visibility.css");
  const locationPicker = await read("packages/frontend/src/game-location/GameLocationPicker.tsx");
  const locationCss = await read("packages/frontend/src/game-location/game-location.css");
  const webCss = await read("apps/web/src/styles.css");

  assert.ok(createPage.includes("<PlayVisibilityField />"));
  assert.ok(editPage.includes("<PlayVisibilityField"));
  assert.ok(createPage.includes('className="event-form__primary-action"'));
  assert.ok(editPage.includes('className="event-form__primary-action"'));

  assert.ok(visibilityField.includes('value="OPEN"'));
  assert.ok(visibilityField.includes('value="PRIVATE"'));
  assert.ok(visibilityField.includes("<strong>Public</strong>"));
  assert.ok(visibilityField.includes("<strong>Private</strong>"));
  assert.ok(
    visibilityCss.includes(
      "background: color-mix(in srgb, var(--app-lime) 9%, transparent);",
    ),
  );
  assert.ok(
    visibilityCss.includes(
      "background: color-mix(in srgb, var(--app-gold) 8%, transparent);",
    ),
  );

  assert.ok(locationPicker.includes("HOOMA Pitch"));
  assert.ok(locationPicker.includes("Other location"));
  assert.ok(locationCss.includes("var(--app-lime, #c6f25a) 11%, transparent"));
  assert.ok(!locationCss.includes("background: var(--color-accent"));

  assert.ok(!webCss.includes(".event-form button,"));
  assert.ok(webCss.includes(".event-form__primary-action,"));
  assert.ok(
    webCss.includes("background: color-mix(in srgb, var(--app-lime) 8%, transparent);"),
  );
});
