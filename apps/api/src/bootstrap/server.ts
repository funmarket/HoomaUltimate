import { loadApiConfig } from "@hooma/config";
import { disconnectDatabase } from "@hooma/database";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";

const config = loadApiConfig();
const container = createContainer(config);
const app = createApp(config, container);
const server = app.listen(config.API_PORT, "0.0.0.0", () => {
  console.log(`HOOMA ULTIMATE API listening on ${config.API_PORT}`);
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
