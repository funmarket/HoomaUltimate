import { createReadStream } from "node:fs";
import { access, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const requestedRoot = process.argv[2];
if (!requestedRoot) throw new Error("Usage: node scripts/serve-static.mjs <directory>");

const root = path.resolve(process.cwd(), requestedRoot);
const port = Number(process.env.PORT ?? 8080);
const mime = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"]
]);

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  const candidate = path.resolve(root, `.${decoded}`);
  if (!candidate.startsWith(root)) return path.join(root, "index.html");

  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
  } catch {
    // SPA fallback below.
  }

  return path.join(root, "index.html");
}

await access(path.join(root, "index.html"));

createServer(async (request, response) => {
  try {
    const file = await resolveFile(request.url ?? "/");
    response.statusCode = 200;
    response.setHeader("Content-Type", mime.get(path.extname(file)) ?? "application/octet-stream");
    createReadStream(file).pipe(response);
  } catch {
    response.statusCode = 500;
    response.end("Internal Server Error");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Static server listening on ${port}`);
});
