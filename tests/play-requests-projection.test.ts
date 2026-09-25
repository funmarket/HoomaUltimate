import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test(
  "Play exposes canonical Requests without owning Request persistence",
  async () => {
    const playPage = await readFile(
      "packages/frontend/src/events/PlayPage.tsx",
      "utf8",
    );
    const pane = await readFile(
      "packages/frontend/src/events/PlayRequestsPane.tsx",
      "utf8",
    );
    const createPage = await readFile(
      "packages/frontend/src/requests/RequestCreatePage.tsx",
      "utf8",
    );
    const playCss = await readFile(
      "packages/frontend/src/events/play.css",
      "utf8",
    );

    assert.match(
      playPage,
      /type PlayView = "games" \| "players" \| "requests" \| "mine"/,
    );
    assert.match(playPage, />\s*Requests\s*</);
    assert.match(playPage, /<PlayRequestsPane \/>/);

    assert.match(pane, /surface: "PLAY"/);
    assert.match(pane, /taxonomy\("PLAY"\)/);
    assert.match(pane, /createRequestsApi/);
    assert.match(pane, /RequestFeed/);
    assert.match(pane, /RequestTaxonomyFilters/);
    assert.match(pane, /href="\/requests\/new\?surface=PLAY"/);
    assert.doesNotMatch(pane, /PlayRequest|createPlayApi/);

    assert.match(createPage, /taxonomySurface === "PLAY"/);
    assert.match(createPage, /requestsApi\.taxonomy\(taxonomySurface\)/);
    assert.match(
      createPage,
      /returnHref = taxonomySurface === "PLAY" \? "\/play" : "\/requests"/,
    );

    assert.match(playCss, /\.play-view-tabs--four/);
    assert.match(
      playCss,
      /@media \(max-width: 620px\)[\s\S]*\.play-view-tabs--four[\s\S]*repeat\(2,/,
    );
  },
);
