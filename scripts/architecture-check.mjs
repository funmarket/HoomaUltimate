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
    forbid(
      file,
      source,
      /@hooma\/database|@prisma\/client/,
      "frontend must not import database code",
    );
  }

  if (rel.startsWith("apps/telegram/src/")) {
    violations.push(
      `${rel}: Telegram is the /telegram entry of the universal HOOMA frontend; do not create a second Telegram product source tree`,
    );
  }

  if (/^apps\/web\/src\/(teams|events)\//.test(rel)) {
    violations.push(
      `${rel}: canonical Teams and Events/Play frontends belong in @hooma/frontend, not the app shell`,
    );
  }

  if (rel.startsWith("apps/web/src/")) {
    forbid(
      file,
      source,
      /["'`]\/api\/(?:public\/v1|v1)\//,
      "product API calls must use the single @hooma/frontend API client",
    );
  }

  if (/^apps\/api\/src\/modules\/[^/]+\/domain\//.test(rel)) {
    forbid(
      file,
      source,
      /express|@hooma\/database|@prisma\/client/,
      "domain layer must be transport and persistence independent",
    );
  }
  if (/^apps\/api\/src\/modules\/[^/]+\/application\//.test(rel)) {
    forbid(file, source, /from ["']express["']/, "application layer must not depend on Express");
  }
  if (/^apps\/api\/src\/modules\/[^/]+\/http\//.test(rel)) {
    forbid(
      file,
      source,
      /@hooma\/database|@prisma\/client/,
      "HTTP layer must not access persistence directly",
    );
  }

  if (rel.startsWith("apps/api/src/modules/places/")) {
    forbid(file, source, /modules\/pitch|\.\.\/\.\.\/pitch\//, "Places must not depend on Pitch");
    forbid(
      file,
      source,
      /modules\/platform-admin|\.\.\/\.\.\/platform-admin\//,
      "Places must not depend on Platform Admin application code",
    );
    forbid(file, source, /@hooma\/contracts\/pitch/, "Places must not depend on Pitch contracts");
    forbid(
      file,
      source,
      /@hooma\/contracts\/platform-admin/,
      "Places must not depend directly on Platform Admin contracts",
    );
  }

  if (rel.startsWith("apps/api/src/modules/pitch/")) {
    forbid(
      file,
      source,
      /modules\/platform-admin|\.\.\/\.\.\/platform-admin\//,
      "Pitch must not depend on Platform Admin application code",
    );
    forbid(
      file,
      source,
      /places\/infrastructure\//,
      "Pitch must use the explicit Places boundary, not Places infrastructure",
    );
  }

  if (/^apps\/api\/src\/modules\/(places|pitch)\//.test(rel)) {
    forbid(
      file,
      source,
      /@hooma\/contracts\/platform-management/,
      "Places and Pitch must not depend on the legacy shared platform-management contract",
    );
  }

  if (rel.startsWith("packages/frontend/src/pitch/")) {
    forbid(
      file,
      source,
      /places\/platform-management-api|@hooma\/contracts\/platform-management/,
      "Pitch frontend must use Pitch-owned contracts and API client",
    );
  }

  if (rel.startsWith("packages/frontend/src/places/")) {
    forbid(
      file,
      source,
      /@hooma\/contracts\/platform-management/,
      "Places frontend must use Place/Pitch domain contracts instead of platform-management",
    );
  }

  if (rel.startsWith("apps/worker/") && /apps\/api\/src\/.*\/http\//.test(source)) {
    violations.push(`${rel}: worker must not import API HTTP controllers/routes`);
  }
}

const canonicalRouterPath = path.join(root, "apps/web/src/app/router/HoomaRouter.tsx");
try {
  const canonicalRouter = await readFile(canonicalRouterPath, "utf8");
  if (!canonicalRouter.includes('path="/telegram"')) {
    violations.push(
      "apps/web/src/app/router/HoomaRouter.tsx: canonical route tree must expose the /telegram entry",
    );
  }
} catch {
  violations.push(
    "apps/web/src/app/router/HoomaRouter.tsx: canonical universal HOOMA router is missing",
  );
}

if (violations.length > 0) {
  console.error("Architecture check failed:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Architecture check passed.");
