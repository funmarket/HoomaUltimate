import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import sharp from "sharp";

const [baselineRoot, candidateRoot] = process.argv.slice(2);
assert(baselineRoot && candidateRoot, "usage: compare-rendered-pngs <baseline> <candidate>");

const [baselineReport, candidateReport] = await Promise.all([
  readFile(resolve(baselineRoot, "report.json"), "utf8").then(JSON.parse),
  readFile(resolve(candidateRoot, "report.json"), "utf8").then(JSON.parse),
]);
assert.equal(candidateReport.length, baselineReport.length, "Dark report lengths differ");
for (let index = 0; index < baselineReport.length; index += 1) {
  const baseline = baselineReport[index];
  const candidate = candidateReport[index];
  assert.deepEqual(
    {
      route: candidate.route,
      width: candidate.width,
      theme: candidate.theme,
      documentWidth: candidate.documentWidth,
      errors: candidate.errors,
      appearance: candidate.appearance,
    },
    {
      route: baseline.route,
      width: baseline.width,
      theme: baseline.theme,
      documentWidth: baseline.documentWidth,
      errors: baseline.errors,
      appearance: baseline.appearance,
    },
    `${candidate.route} at ${candidate.width}px changed its rendered Dark appearance`,
  );
}

const files = (await readdir(baselineRoot, { recursive: true }))
  .filter((path) => path.endsWith(".png"))
  .sort();
assert(files.length > 0, "no baseline PNG evidence found");

let changedPixels = 0;
let totalPixels = 0;
for (const path of files) {
  const baselinePath = resolve(baselineRoot, path);
  const candidatePath = resolve(candidateRoot, path);
  const [baseline, candidate] = await Promise.all([
    sharp(baselinePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(candidatePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  assert.deepEqual(
    candidate.info,
    baseline.info,
    `${relative(process.cwd(), candidatePath)} dimensions differ from the baseline`,
  );
  totalPixels += baseline.info.width * baseline.info.height;
  for (let offset = 0; offset < baseline.data.length; offset += 4) {
    if (
      baseline.data[offset] !== candidate.data[offset] ||
      baseline.data[offset + 1] !== candidate.data[offset + 1] ||
      baseline.data[offset + 2] !== candidate.data[offset + 2] ||
      baseline.data[offset + 3] !== candidate.data[offset + 3]
    ) {
      changedPixels += 1;
    }
  }
}

console.log(
  `Verified ${files.length} Dark renders with identical computed appearance; ${changedPixels} of ${totalPixels} screenshot pixels varied across isolated browser sessions.`,
);
