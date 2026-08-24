import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "package.json",
  "package-lock.json",
  "structure.md",
  "requirements.md",
  "apps/api/package.json",
  "apps/web/package.json",
  "apps/telegram/package.json",
  "apps/worker/package.json",
  "packages/auth/package.json",
  "packages/config/package.json",
  "packages/contracts/package.json",
  "packages/database/package.json",
  "packages/database/prisma/schema.prisma",
  "packages/database/prisma/migrations/migration_lock.toml",
  "packages/domain/package.json",
  "packages/storage/package.json",
  "packages/testing/package.json",
  "packages/ui/package.json",
  ".github/workflows/ci.yml",
];

const missing = [];
for (const item of required) {
  try {
    await access(path.join(root, item));
  } catch {
    missing.push(item);
  }
}
if (missing.length > 0) {
  console.error(`Deploy preflight failed. Missing: ${missing.join(", ")}`);
  process.exit(1);
}

const migrationRoot = path.join(root, "packages/database/prisma/migrations");
const migrationDirectories = (await readdir(migrationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
if (migrationDirectories.length === 0) {
  console.error("Deploy preflight failed. At least one committed Prisma migration is required.");
  process.exit(1);
}
for (const directory of migrationDirectories) {
  await access(path.join(migrationRoot, directory, "migration.sql"));
}

const envExample = await readFile(path.join(root, ".env.example"), "utf8");
for (const key of ["TELEGRAM_BOT_TOKEN", "MINI_APP_URL", "DATABASE_URL", "REDIS_URL"]) {
  if (!envExample.includes(`${key}=`)) {
    console.error(`Deploy preflight failed. .env.example is missing ${key}.`);
    process.exit(1);
  }
}

const rootEntries = await readdir(root);
if (rootEntries.includes(".env")) {
  console.error(
    "Deploy preflight failed. A real .env file must not be committed at repository root.",
  );
  process.exit(1);
}

console.log("Deploy preflight passed.");
