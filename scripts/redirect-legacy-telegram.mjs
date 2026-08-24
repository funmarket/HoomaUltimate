import http from "node:http";

const port = Number(process.env.PORT || 8080);
const targetOrigin = (
  process.env.HOOMA_CANONICAL_WEB_ORIGIN || "https://hooma-web-production.up.railway.app"
).replace(/\/$/, "");
const targetPath = "/telegram";

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || "/", "http://legacy.hooma.local");
  const location = `${targetOrigin}${targetPath}${requestUrl.search}`;

  response.statusCode = 302;
  response.setHeader("Location", location);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Content-Type", "text/plain; charset=utf-8");
  response.end(`HOOMA moved to ${location}\n`);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Legacy HOOMA Telegram entry redirecting to ${targetOrigin}${targetPath}`);
});
