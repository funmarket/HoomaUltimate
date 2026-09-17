import { spawnSync } from "node:child_process";

const files = [
  "apps/api/src/modules/requests/application/request.service.ts",
  "apps/api/src/modules/requests/http/request.routes.ts",
  "apps/api/src/modules/requests/infrastructure/prisma-request.repository.ts",
];

const prettier = spawnSync("npm", ["exec", "--", "prettier", "--write", ...files], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (prettier.error) {
  console.error(prettier.error.message);
  process.exit(1);
}

const diff = spawnSync("git", ["diff", "--", ...files], {
  encoding: "utf8",
  shell: process.platform === "win32",
});
console.log(diff.stdout || "No formatting diff.");
process.exit(1);
