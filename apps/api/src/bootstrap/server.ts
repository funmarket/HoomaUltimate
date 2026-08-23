import { loadApiConfig } from "@hooma/config";
import { disconnectDatabase } from "@hooma/database";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";

const config = loadApiConfig();
const container = createContainer(config);
const app = createApp(config, container);
// HOOMA owns an explicit API_PORT contract. Railway's generic PORT is only
// relevant when an application does not define its own service port. This
// service and its public domain are configured for API_PORT, so keep the
// process bound to that canonical value instead of silently overriding it.
const listenPort = config.API_PORT;
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
