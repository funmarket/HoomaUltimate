import { spawnSync } from "node:child_process";

const target = "packages/frontend/src/events/FormationBuilderPage.tsx";

const prettier = spawnSync("npm", ["exec", "--", "prettier", "--write", target], {
  stdio: "inherit",
});

if ((prettier.status ?? 1) !== 0) {
  process.exit(prettier.status ?? 1);
}

spawnSync("git", ["diff", "--", target], {
  stdio: "inherit",
});

process.exit(1);
