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
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"]
]);

function isInsideRoot(candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  const candidate = path.resolve(root, `.${decoded}`);
  if (!isInsideRoot(candidate)) return path.join(root, "index.html");

  try {
    const info = await stat(candidate);
    if (info.isFile()) return candidate;
  } catch {
    // SPA fallback below.
  }

  return path.join(root, "index.html");
}

function cacheControlFor(file) {
  const extension = path.extname(file).toLowerCase();
  if (extension === ".html") return "no-cache";

  const relativePath = path.relative(root, file).split(path.sep).join("/");
  if (relativePath.startsWith("assets/")) {
    return "public, max-age=31536000, immutable";
  }

  return "public, max-age=0, must-revalidate";
}

await access(path.join(root, "index.html"));

createServer(async (request, response) => {
  try {
    const file = await resolveFile(request.url ?? "/");
    const info = await stat(file);
    const extension = path.extname(file).toLowerCase();
    const etag = `W/\"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}\"`;

    response.setHeader("Content-Type", mime.get(extension) ?? "application/octet-stream");
    response.setHeader("Content-Length", String(info.size));
    response.setHeader("Cache-Control", cacheControlFor(file));
    response.setHeader("ETag", etag);
    response.setHeader("Last-Modified", info.mtime.toUTCString());

    if (request.headers["if-none-match"] === etag) {
      response.statusCode = 304;
      response.end();
      return;
    }

    response.statusCode = 200;
    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(file).pipe(response);
  } catch {
    response.statusCode = 500;
    response.end("Internal Server Error");
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Static server listening on ${port}`);
});
