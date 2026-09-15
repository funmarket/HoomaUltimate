import { spawnSync } from "node:child_process";

const files = [
  "apps/web/src/admin/ControlRoomOverview.tsx",
  "apps/web/src/admin/ManagedEntities.tsx",
  "apps/web/src/admin/ReviewQueues.tsx",
];

for (const file of files) {
  const result = spawnSync("npm", ["exec", "--", "prettier", file], {
    encoding: "utf8",
  });
  console.log(`=== PRETTIER ${file} ===`);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  console.log(`=== END ${file} ===`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

process.exit(1);
