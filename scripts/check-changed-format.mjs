import { spawnSync } from "node:child_process";

const files = [
  "packages/frontend/src/events/FormationBuilderPage.tsx",
  "packages/frontend/src/events/formation-builder-pitch.css",
];

const prettier = spawnSync("npm", ["exec", "--", "prettier", "--write", ...files], {
  stdio: "inherit",
});

if ((prettier.status ?? 1) !== 0) {
  process.exit(prettier.status ?? 1);
}

spawnSync("git", ["diff", "--", ...files], {
  stdio: "inherit",
});

process.exit(1);
