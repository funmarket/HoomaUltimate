import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Athletes exposes canonical non-football Requests without owning Request persistence", async () => {
  const [page, pane, createPage, requestRepo, taxonomyService] = await Promise.all([
    readFile("packages/frontend/src/athletes/AthletesPages.tsx", "utf8"),
    readFile("packages/frontend/src/athletes/AthletesRequestsPane.tsx", "utf8"),
    readFile("packages/frontend/src/requests/RequestCreatePage.tsx", "utf8"),
    readFile("apps/api/src/modules/requests/infrastructure/prisma-request.repository.ts", "utf8"),
    readFile(
      "apps/api/src/modules/help-taxonomy/application/help-taxonomy.service.ts",
      "utf8",
    ),
  ]);

  assert.match(page, /type AthletesView = "communities" \| "requests"/);
  assert.match(page, />\s*Requests\s*<\/button>/);
  assert.match(page, /<AthletesRequestsPane \/>/);

  assert.match(pane, /surface: "ATHLETES"/);
  assert.match(pane, /taxonomy\("ATHLETES"\)/);
  assert.match(pane, /createRequestsApi/);
  assert.match(pane, /RequestFeed/);
  assert.match(pane, /RequestTaxonomyFilters/);
  assert.match(pane, /href="\/requests\/new\?surface=ATHLETES"/);
  assert.doesNotMatch(
    pane,
    /(?:interface|type|class)\s+AthleteRequest\b|createAthletesRequestApi/,
  );

  assert.match(createPage, /surface === "PLAY" \|\| surface === "ATHLETES"/);
  assert.match(createPage, /taxonomySurface === "ATHLETES" \? "\/athletes"/);

  assert.match(requestRepo, /input\.surface === "ATHLETES"[\s\S]*NOT: \{ sport: "FOOTBALL" \}/);
  assert.match(
    taxonomyService,
    /input\.surface === "ATHLETES"[\s\S]*row\.sport === "FOOTBALL"/,
  );
});
