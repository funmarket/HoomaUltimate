import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const requestRepositoryPort = readFileSync(
  "apps/api/src/modules/requests/application/request.repository.ts",
  "utf8",
);
const requestRepositoryImplementation = readFileSync(
  "apps/api/src/modules/requests/infrastructure/prisma-request.repository.ts",
  "utf8",
);

test("Requests consume shared Help access instead of owning authority lookups", () => {
  assert.doesNotMatch(requestRepositoryPort, /interface RequestVisibilityReader/);
  assert.doesNotMatch(
    requestRepositoryImplementation,
    /implements RequestRepository,\s*RequestVisibilityReader/,
  );
  assert.doesNotMatch(requestRepositoryImplementation, /async communityRole\(/);
  assert.doesNotMatch(requestRepositoryImplementation, /async teamResponsibility\(/);
  assert.doesNotMatch(requestRepositoryImplementation, /async athletesRole\(/);
  assert.match(
    readFileSync("apps/api/src/modules/help/application/help-access.reader.ts", "utf8"),
    /export interface HelpAccessReader/,
  );
});
