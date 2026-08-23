import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const ignored = new Set(["node_modules", "dist", "coverage", ".git"]);
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".mjs"]);
const violations = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(absolute)));
    else files.push(absolute);
  }

  return files;
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function forbid(file, source, pattern, reason) {
  if (pattern.test(source)) violations.push(`${relative(file)}: ${reason}`);
}

for (const file of await walk(root)) {
  const rel = relative(file);
  if (!sourceExtensions.has(path.extname(file))) continue;
  const source = await readFile(file, "utf8");

  if (rel.startsWith("apps/web/") || rel.startsWith("apps/telegram/")) {
    forbid(file, source, /@hooma\/database|@prisma\/client/, "frontend must not import database code");
  }

  if (/^apps\/(web|telegram)\/src\/teams\//.test(rel)) {
    violations.push(`${rel}: canonical Teams frontend belongs in @hooma/frontend, not a platform app`);
  }

  if (/^apps\/(web|telegram)\/src\//.test(rel)) {
    forbid(
      file,
      source,
      /["'`]\/api\/(?:public\/v1|v1)\/teams(?:[/?"'`]|$)/,
      "platform apps must consume the shared Teams API client from @hooma/frontend"
    );
  }

  if (/^apps\/api\/src\/modules\/[^/]+\/domain\//.test(rel)) {
    forbid(file, source, /express|@hooma\/database|@prisma\/client/, "domain layer must be transport and persistence independent");
  }

  if (/^apps\/api\/src\/modules\/[^/]+\/application\//.test(rel)) {
    forbid(file, source, /from ["']express["']/, "application layer must not depend on Express");
  }

  if (/^apps\/api\/src\/modules\/[^/]+\/http\//.test(rel)) {
    forbid(file, source, /@hooma\/database|@prisma\/client/, "HTTP layer must not access persistence directly");
  }

  if (rel.startsWith("apps/worker/") && /apps\/api\/src\/.*\/http\//.test(source)) {
    violations.push(`${rel}: worker must not import API HTTP controllers/routes`);
  }
}

if (violations.length > 0) {
  console.error("Architecture check failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("Architecture check passed.");
