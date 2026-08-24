import { copyFile, mkdir, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const sourceRoot = join(packageRoot, "src");
const outputRoot = join(packageRoot, "dist");

async function copyCssTree(sourceDir, outputDir) {
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const outputPath = join(outputDir, entry.name);

    if (entry.isDirectory()) {
      await copyCssTree(sourcePath, outputPath);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".css")) continue;

    await mkdir(dirname(outputPath), { recursive: true });
    await copyFile(sourcePath, outputPath);
  }
}

await copyCssTree(sourceRoot, outputRoot);
