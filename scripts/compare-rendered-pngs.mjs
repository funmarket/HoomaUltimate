import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import sharp from "sharp";

const [baselineRoot, candidateRoot] = process.argv.slice(2);
assert(baselineRoot && candidateRoot, "usage: compare-rendered-pngs <baseline> <candidate>");

const files = (await readdir(baselineRoot, { recursive: true }))
  .filter((path) => path.endsWith(".png"))
  .sort();
assert(files.length > 0, "no baseline PNG evidence found");

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
  assert.equal(
    Buffer.compare(candidate.data, baseline.data),
    0,
    `${relative(process.cwd(), candidatePath)} rendered pixels differ from the baseline`,
  );
}

console.log(`Verified ${files.length} Dark screenshots with zero decoded-pixel differences.`);
