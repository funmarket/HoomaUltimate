import { loadApiConfig } from "@hooma/config";
import { disconnectDatabase } from "@hooma/database";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";

const config = loadApiConfig();
const container = createContainer(config);
const app = createApp(config, container);
// Railway owns PORT in production; API_PORT remains the explicit local/default
// HOOMA fallback. The Railway service config pins PORT to the same port used by
// its public domain, so health checks, proxy routing and the process agree.
const listenPort = config.PORT ?? config.API_PORT;
const server = app.listen(listenPort, "0.0.0.0", () => {
  console.log(`HOOMA API listening on ${listenPort}`);
});

function shutdown(signal: NodeJS.Signals) {
  console.log(`Received ${signal}; shutting down API.`);
  server.close((error) => {
    if (error) console.error(error);
    void disconnectDatabase().finally(() => {
      process.exitCode = error ? 1 : 0;
    });
  });
}

process.once("SIGTERM", shutdown);
process.once("SIGINT", shutdown);
