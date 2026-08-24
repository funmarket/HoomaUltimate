import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../packages/frontend/package.json", import.meta.url), "utf8"));
const lineupPitch = await readFile(new URL("../packages/frontend/src/teams/TeamLineupPitch.tsx", import.meta.url), "utf8");
const copyScript = await readFile(new URL("../packages/frontend/scripts/copy-css.mjs", import.meta.url), "utf8");

test("frontend package build preserves component CSS required by emitted JS", () => {
  assert.match(lineupPitch, /import "\.\/TeamLineupPitch\.css";/);
  assert.equal(packageJson.scripts.build, "tsc -p tsconfig.json && node ./scripts/copy-css.mjs");
  assert.match(copyScript, /entry\.name\.endsWith\("\.css"\)/);
  assert.match(copyScript, /copyFile\(sourcePath, outputPath\)/);
  assert.match(copyScript, /await mkdir\(dirname\(outputPath\), \{ recursive: true \}\)/);
});
